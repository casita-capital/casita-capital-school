import { NextRequest, NextResponse } from 'next/server';
import { inflateRawSync } from 'zlib';
import {
  DAY_KEYS,
  DayKey,
  SubjectRecurringConfig,
  createDefaultDayConfig,
  createDefaultMathConfig,
  createDefaultRecurringConfig,
} from 'src/utils/recurring-planner';

export interface ExtractedSyllabusDayItem {
  day_number: number;
  week_number?: number;
  unit?: string;
  activity?: string;
  semester: number;
  workbook: string;
  textbook: string;
  topic: string;
  materials: string;
  fast_facts: string;
  notes: string;
}

export interface ParsedSyllabusReviewPayload {
  model_used: string;
  detected_subject_name: string;
  course_title: string;
  teacher_name: string;
  summary: string;
  highlights: string[];
  recommended_mode: 'template' | 'math_syllabus';
  recurring_config: SubjectRecurringConfig;
  syllabus_days: ExtractedSyllabusDayItem[];
}

interface GeminiDayTemplateRaw {
  enabled?: boolean;
  attend_class?: boolean;
  attend_class_label?: string;
  fast_facts?: boolean;
  fast_facts_label?: string;
  template?: string;
}

interface GeminiSyllabusResponseRaw {
  detected_subject_name?: string;
  course_title?: string;
  teacher_name?: string;
  summary?: string;
  highlights?: string[];
  recommended_mode?: 'template' | 'math_syllabus';
  base_week_num?: number;
  base_class_num?: number;
  base_lesson_num?: number;
  monday?: GeminiDayTemplateRaw;
  tuesday?: GeminiDayTemplateRaw;
  wednesday?: GeminiDayTemplateRaw;
  thursday?: GeminiDayTemplateRaw;
  friday?: GeminiDayTemplateRaw;
  math_config?: {
    fast_facts_enabled?: boolean;
    fast_facts_label?: string;
    fast_facts_days?: string[];
    include_fast_facts_topic?: boolean;
    attend_class_enabled?: boolean;
    attend_class_label?: string;
    attend_class_days?: string[];
    homework_enabled?: boolean;
    homework_label?: string;
    monday_homework_source?: string;
    wednesday_homework_source?: string;
    include_materials?: boolean;
    include_topic?: boolean;
    include_textbook?: boolean;
    include_homework_notes?: boolean;
    base_tuesday_day?: number;
    base_thursday_day?: number;
  };
  syllabus_days?: Array<{
    day_number?: number;
    week_number?: number;
    unit?: string;
    activity?: string;
    semester?: number;
    workbook?: string;
    textbook?: string;
    topic?: string;
    materials?: string;
    fast_facts?: string;
    notes?: string;
  }>;
}

/**
 * Minimal zero-dependency ZIP + XML extractor for .xlsx spreadsheets
 * Converts sharedStrings.xml + sheet*.xml into readable Markdown tables for Gemini Flash.
 */
function extractTextFromXlsxBuffer(buf: Buffer): string {
  const files = new Map<string, string>();
  let offset = 0;

  while (offset + 30 <= buf.length) {
    const signature = buf.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      break;
    }
    const bitFlag = buf.readUInt16LE(offset + 6);
    const compressionMethod = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const fileNameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const fileName = buf.subarray(offset + 30, offset + 30 + fileNameLen).toString('utf8');
    const dataStart = offset + 30 + fileNameLen + extraLen;

    if ((bitFlag & 0x08) !== 0 && compressedSize === 0) {
      break;
    }

    const compressedSlice = buf.subarray(dataStart, dataStart + compressedSize);
    if (
      fileName === 'xl/sharedStrings.xml' ||
      (fileName.startsWith('xl/worksheets/sheet') && fileName.endsWith('.xml'))
    ) {
      try {
        const rawBytes =
          compressionMethod === 0
            ? compressedSlice
            : compressionMethod === 8
              ? inflateRawSync(compressedSlice)
              : null;
        if (rawBytes) {
          files.set(fileName, rawBytes.toString('utf8'));
        }
      } catch {
        // Ignore individual corrupt entry
      }
    }

    offset = dataStart + compressedSize;
  }

  const decodeXmlEntities = (str: string): string =>
    str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#10;/g, ' ')
      .replace(/&#13;/g, ' ');

  const sharedStrings: string[] = [];
  const sstXml = files.get('xl/sharedStrings.xml');
  if (sstXml) {
    const siMatches = sstXml.match(/<si[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      const combined = tMatches
        .map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, '')))
        .join('');
      sharedStrings.push(combined);
    }
  }

  const sheetOutputs: string[] = [];
  const sortedSheetNames = Array.from(files.keys())
    .filter((k) => k.startsWith('xl/worksheets/sheet'))
    .sort();

  for (const sheetName of sortedSheetNames) {
    const xml = files.get(sheetName) || '';
    const rowMatches = xml.match(/<row[\s\S]*?<\/row>/g) || [];
    const lines: string[] = [];

    for (const rowXml of rowMatches) {
      const cellMatches = rowXml.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || [];
      const rowCells: string[] = [];

      for (const cellXml of cellMatches) {
        const refMatch = cellXml.match(/\br="([A-Z]+)\d+"/);
        const typeMatch = cellXml.match(/\bt="([^"]+)"/);
        const valMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
        const inlineMatch = cellXml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);

        let textVal = '';
        if (typeMatch && typeMatch[1] === 's' && valMatch) {
          const idx = parseInt(valMatch[1], 10);
          textVal = sharedStrings[idx] ?? '';
        } else if (inlineMatch) {
          textVal = decodeXmlEntities(inlineMatch[1]);
        } else if (valMatch) {
          textVal = decodeXmlEntities(valMatch[1]);
        }

        const trimmed = textVal.replace(/\s+/g, ' ').trim();
        if (trimmed) {
          const colLabel = refMatch ? refMatch[1] : '';
          rowCells.push(colLabel ? `[${colLabel}] ${trimmed}` : trimmed);
        }
      }

      if (rowCells.length > 0) {
        lines.push(rowCells.join(' | '));
      }
    }

    if (lines.length > 0) {
      sheetOutputs.push(`=== Worksheet (${sheetName}) ===\n${lines.join('\n')}`);
    }
  }

  return sheetOutputs.join('\n\n');
}

function scoreFlashModel(modelName: string): number {
  const lower = modelName.toLowerCase();
  if (!lower.includes('flash')) return -100;
  if (lower.includes('tts') || lower.includes('image') || lower.includes('audio') || lower.includes('embedding')) {
    return -50;
  }

  let score = 100;
  if (lower.includes('2.5-flash')) score += 50;
  else if (lower.includes('2.0-flash')) score += 35;
  else if (lower.includes('1.5-flash')) score += 20;
  else if (lower === 'gemini-flash-latest') score += 25;

  // Prefer full flash over flash-lite
  if (lower.includes('lite')) score -= 18;
  // Prefer stable release over experimental/preview if same major version
  if (lower === 'gemini-2.5-flash') score += 10;
  if (lower === 'gemini-2.0-flash') score += 8;
  if (lower === 'gemini-1.5-flash-latest') score += 5;

  return score;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const subjectNameHint = (formData.get('subjectName') as string | null) || '';

    if (!file) {
      return NextResponse.json({ error: 'No syllabus file uploaded.' }, { status: 400 });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_SHEETS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is missing from environment variables (GEMINI_API_KEY).' },
        { status: 500 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileNameLower = file.name.toLowerCase();

    let extractedSpreadsheetText = '';
    let inlineMimeType: string | null = null;

    if (fileNameLower.endsWith('.xlsx')) {
      extractedSpreadsheetText = extractTextFromXlsxBuffer(fileBuffer);
      if (!extractedSpreadsheetText.trim()) {
        return NextResponse.json(
          { error: 'Could not read worksheet rows from the uploaded .xlsx file.' },
          { status: 400 }
        );
      }
    } else if (
      fileNameLower.endsWith('.csv') ||
      fileNameLower.endsWith('.txt') ||
      fileNameLower.endsWith('.md')
    ) {
      extractedSpreadsheetText = fileBuffer.toString('utf8');
    } else if (fileNameLower.endsWith('.pdf')) {
      inlineMimeType = 'application/pdf';
    } else if (fileNameLower.endsWith('.png')) {
      inlineMimeType = 'image/png';
    } else if (fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg')) {
      inlineMimeType = 'image/jpeg';
    } else if (fileNameLower.endsWith('.webp')) {
      inlineMimeType = 'image/webp';
    } else {
      inlineMimeType = file.type || 'application/pdf';
    }

    const systemPrompt = `You are an expert curriculum and school syllabus analyzer for Casita Capital School.
Your job is to review the uploaded syllabus document ("${file.name}")${subjectNameHint ? ` for subject "${subjectNameHint}"` : ''} and design a weekly recurring planner automation for it.

Analyze the syllabus and determine:
1. "detected_subject_name": The school subject (e.g. "Math", "Science", "Spelling", "Biblioplan", "Composition & Grammar", "Latin", "Classical Studies").
2. "course_title": The specific course or textbook title (e.g. "Dimensions Math Level 5A (Fall)" or "Grade 5 Science").
3. "teacher_name": The instructor's name if mentioned (or empty string if not listed).
4. "summary": A clear, helpful 2-3 sentence review summarizing how the syllabus is structured (e.g., numbered class days, homework workbook pages, weekly lessons, quizzes/tests, and required materials).
5. "highlights": 3 to 5 concise bullet strings highlighting key patterns found in the syllabus.
6. "recommended_mode":
   - Choose "math_syllabus" if the syllabus is organized as numbered class Days (e.g., Day 1 to Day 32 or Day 33 to Day 64) with specific Workbook/Textbook pages, Topics, Materials, and Fast Facts per Day.
   - Choose "template" if the syllabus follows a standard weekly pattern (e.g. Monday–Friday templates using dynamic counters like {week}, {class_num}, {lesson}, {prev_lesson}).
7. For "monday", "tuesday", "wednesday", "thursday", "friday":
   - Provide the recurring template configuration for each weekday:
     - "enabled": boolean (true if the student has class or homework on this day)
     - "attend_class": boolean (true if the student attends live/in-person class on this day)
     - "attend_class_label": string (e.g. "• Attend Class")
     - "fast_facts": boolean (true if daily fast facts drill applies on this day)
     - "fast_facts_label": string (e.g. "- [ ] Fast Facts")
     - "template": multi-line checklist or bullet instructions for that day (e.g. "Week {week}\\n- [ ] Do 2 workbook pages\\n- [ ] Review vocabulary").
8. If "recommended_mode" is "math_syllabus" OR the document contains numbered syllabus days/classes/lessons (such as a 35-week / 105-class Science schedule with 3 classes per week):
   - Populate "syllabus_days" with ALL numbered classes or days found in the document:
     - "day_number": integer (e.g. 1..105 for a 105-class curriculum, or 1..32 for Fall / 33..64 for Spring)
     - "week_number": integer (e.g. 1..35 corresponding to the week of that class; if 3 classes per week, Classes 1-3 have week_number 1, etc.)
     - "unit": string (the unit or module name if applicable, e.g. "Introduction", "Chemistry", "Physics", "Astronomy")
     - "activity": string (any hands-on activity, lab, or experiment listed for that class, without the leading "Activity:" prefix)
     - "semester": 1 for Fall / Semester 1, 2 for Spring / Semester 2
     - "workbook": workbook homework pages (e.g. "p. 1-4" or "Worksheet")
     - "textbook": textbook pages (e.g. "p. 1-9")
     - "topic": lesson or class topic description
     - "materials": additional class materials to bring
     - "fast_facts": fast facts drill description
     - "notes": any teacher or homework notes

Return strictly valid JSON matching the schema.`;

    const dayTemplateSchema = {
      type: 'OBJECT',
      properties: {
        enabled: { type: 'BOOLEAN' },
        attend_class: { type: 'BOOLEAN' },
        attend_class_label: { type: 'STRING' },
        fast_facts: { type: 'BOOLEAN' },
        fast_facts_label: { type: 'STRING' },
        template: { type: 'STRING' },
      },
      required: ['enabled', 'attend_class', 'attend_class_label', 'fast_facts', 'fast_facts_label', 'template'],
    };

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        detected_subject_name: { type: 'STRING' },
        course_title: { type: 'STRING' },
        teacher_name: { type: 'STRING' },
        summary: { type: 'STRING' },
        highlights: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
        recommended_mode: {
          type: 'STRING',
          enum: ['template', 'math_syllabus'],
        },
        base_week_num: { type: 'INTEGER' },
        base_class_num: { type: 'INTEGER' },
        base_lesson_num: { type: 'INTEGER' },
        monday: dayTemplateSchema,
        tuesday: dayTemplateSchema,
        wednesday: dayTemplateSchema,
        thursday: dayTemplateSchema,
        friday: dayTemplateSchema,
        math_config: {
          type: 'OBJECT',
          properties: {
            fast_facts_enabled: { type: 'BOOLEAN' },
            fast_facts_label: { type: 'STRING' },
            fast_facts_days: { type: 'ARRAY', items: { type: 'STRING' } },
            include_fast_facts_topic: { type: 'BOOLEAN' },
            attend_class_enabled: { type: 'BOOLEAN' },
            attend_class_label: { type: 'STRING' },
            attend_class_days: { type: 'ARRAY', items: { type: 'STRING' } },
            homework_enabled: { type: 'BOOLEAN' },
            homework_label: { type: 'STRING' },
            monday_homework_source: { type: 'STRING' },
            wednesday_homework_source: { type: 'STRING' },
            include_materials: { type: 'BOOLEAN' },
            include_topic: { type: 'BOOLEAN' },
            include_textbook: { type: 'BOOLEAN' },
            include_homework_notes: { type: 'BOOLEAN' },
            base_tuesday_day: { type: 'INTEGER' },
            base_thursday_day: { type: 'INTEGER' },
          },
        },
        syllabus_days: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              day_number: { type: 'INTEGER' },
              week_number: { type: 'INTEGER' },
              unit: { type: 'STRING' },
              activity: { type: 'STRING' },
              semester: { type: 'INTEGER' },
              workbook: { type: 'STRING' },
              textbook: { type: 'STRING' },
              topic: { type: 'STRING' },
              materials: { type: 'STRING' },
              fast_facts: { type: 'STRING' },
              notes: { type: 'STRING' },
            },
            required: ['day_number', 'semester', 'workbook', 'textbook', 'topic', 'materials', 'fast_facts', 'notes'],
          },
        },
      },
      required: [
        'detected_subject_name',
        'course_title',
        'teacher_name',
        'summary',
        'highlights',
        'recommended_mode',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'syllabus_days',
      ],
    };

    // Prioritize highest-level free-tier Gemini Flash models first (mirroring casita-capital-internal)
    let modelsToTry: string[] = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash-latest',
      'gemini-flash-latest',
      'gemini-1.5-flash',
    ];

    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const listData = (await listRes.json()) as {
          models?: Array<{
            name: string;
            supportedGenerationMethods?: string[];
          }>;
        };
        if (listData.models && listData.models.length > 0) {
          const discoveredFlash = listData.models
            .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m) => m.name.replace(/^models\//, ''))
            .filter((name) => scoreFlashModel(name) > 0)
            .sort((a, b) => scoreFlashModel(b) - scoreFlashModel(a));

          if (discoveredFlash.length > 0) {
            modelsToTry = Array.from(new Set([...discoveredFlash, ...modelsToTry]));
          }
        }
      }
    } catch {
      // Fallback to default prioritized Flash list
    }

    const parts: Array<Record<string, unknown>> = [{ text: systemPrompt }];
    if (extractedSpreadsheetText) {
      parts.push({
        text: `EXTRACTED SYLLABUS CONTENT FROM "${file.name}":\n\n${extractedSpreadsheetText.slice(0, 120000)}`,
      });
    } else if (inlineMimeType) {
      parts.push({
        inlineData: {
          mimeType: inlineMimeType,
          data: fileBuffer.toString('base64'),
        },
      });
    }

    let rawParsed: GeminiSyllabusResponseRaw | null = null;
    let modelUsed = '';
    let lastError = '';

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              responseSchema,
            },
          }),
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          lastError = `[${model}] (${geminiRes.status}): ${errText}`;
          continue;
        }

        const geminiJson = (await geminiRes.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };

        const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          lastError = `[${model}]: Empty response text`;
          continue;
        }

        rawParsed = JSON.parse(rawText) as GeminiSyllabusResponseRaw;
        modelUsed = model;
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!rawParsed) {
      return NextResponse.json(
        { error: `Failed to analyze syllabus with Gemini Flash: ${lastError}` },
        { status: 500 }
      );
    }

    const detectedSubject =
      rawParsed.detected_subject_name?.trim() || subjectNameHint.trim() || 'Subject';
    const baseConfig = createDefaultRecurringConfig(detectedSubject);
    const recommendedMode: 'template' | 'math_syllabus' =
      rawParsed.recommended_mode === 'math_syllabus' ? 'math_syllabus' : 'template';

    const sanitizeDayKeyList = (arr: string[] | undefined, fallback: DayKey[]): DayKey[] => {
      if (!Array.isArray(arr)) return fallback;
      const valid = arr
        .map((d) => d.toLowerCase().trim())
        .filter((d): d is DayKey => DAY_KEYS.includes(d as DayKey));
      return valid.length > 0 ? valid : fallback;
    };

    const defaultMc = createDefaultMathConfig();
    const defaultDay = createDefaultDayConfig();
    const rawMc = rawParsed.math_config;

    const buildDay = (rawDay?: GeminiDayTemplateRaw) => ({
      ...defaultDay,
      enabled: rawDay?.enabled ?? false,
      attend_class: rawDay?.attend_class ?? false,
      attend_class_label: rawDay?.attend_class_label || defaultDay.attend_class_label,
      fast_facts: rawDay?.fast_facts ?? false,
      fast_facts_label: rawDay?.fast_facts_label || defaultDay.fast_facts_label,
      template: rawDay?.template ?? '',
    });

    const recurringConfig: SubjectRecurringConfig = {
      ...baseConfig,
      enabled: true,
      mode: recommendedMode,
      base_week_date: '2026-10-12',
      base_week_num: rawParsed.base_week_num || 7,
      base_class_num: rawParsed.base_class_num || 19,
      base_lesson_num: rawParsed.base_lesson_num || 7,
      days: {
        monday: buildDay(rawParsed.monday),
        tuesday: buildDay(rawParsed.tuesday),
        wednesday: buildDay(rawParsed.wednesday),
        thursday: buildDay(rawParsed.thursday),
        friday: buildDay(rawParsed.friday),
      },
      math_config: {
        fast_facts_enabled: rawMc?.fast_facts_enabled ?? defaultMc.fast_facts_enabled,
        fast_facts_label: rawMc?.fast_facts_label || defaultMc.fast_facts_label,
        fast_facts_days: sanitizeDayKeyList(rawMc?.fast_facts_days, defaultMc.fast_facts_days),
        include_fast_facts_topic:
          rawMc?.include_fast_facts_topic ?? defaultMc.include_fast_facts_topic,
        attend_class_enabled: rawMc?.attend_class_enabled ?? defaultMc.attend_class_enabled,
        attend_class_label: rawMc?.attend_class_label || defaultMc.attend_class_label,
        attend_class_days: sanitizeDayKeyList(rawMc?.attend_class_days, defaultMc.attend_class_days),
        homework_enabled: rawMc?.homework_enabled ?? defaultMc.homework_enabled,
        homework_label: rawMc?.homework_label || defaultMc.homework_label,
        monday_homework_source:
          rawMc?.monday_homework_source === 'tuesday_class' ||
          rawMc?.monday_homework_source === 'thursday_class' ||
          rawMc?.monday_homework_source === 'none'
            ? rawMc.monday_homework_source
            : defaultMc.monday_homework_source,
        wednesday_homework_source:
          rawMc?.wednesday_homework_source === 'tuesday_class' ||
          rawMc?.wednesday_homework_source === 'thursday_class' ||
          rawMc?.wednesday_homework_source === 'none'
            ? rawMc.wednesday_homework_source
            : defaultMc.wednesday_homework_source,
        include_materials: rawMc?.include_materials ?? defaultMc.include_materials,
        include_topic: rawMc?.include_topic ?? defaultMc.include_topic,
        include_textbook: rawMc?.include_textbook ?? defaultMc.include_textbook,
        include_homework_notes: rawMc?.include_homework_notes ?? defaultMc.include_homework_notes,
        base_tuesday_day: rawMc?.base_tuesday_day || defaultMc.base_tuesday_day,
        base_thursday_day: rawMc?.base_thursday_day || defaultMc.base_thursday_day,
      },
    };

    const syllabusDays: ExtractedSyllabusDayItem[] = (rawParsed.syllabus_days || []).map(
      (item, index) => ({
        day_number: item.day_number ?? index + 1,
        week_number:
          typeof item.week_number === 'number' && item.week_number > 0
            ? item.week_number
            : Math.ceil((item.day_number ?? index + 1) / 3),
        unit: item.unit ?? '',
        activity: item.activity ?? '',
        semester: item.semester === 2 ? 2 : 1,
        workbook: item.workbook ?? '',
        textbook: item.textbook ?? '',
        topic: item.topic ?? '',
        materials: item.materials ?? '',
        fast_facts: item.fast_facts ?? '',
        notes: item.notes ?? '',
      })
    );

    const payload: ParsedSyllabusReviewPayload = {
      model_used: modelUsed,
      detected_subject_name: detectedSubject,
      course_title: rawParsed.course_title || file.name,
      teacher_name: rawParsed.teacher_name || '',
      summary:
        rawParsed.summary ||
        `Processed ${file.name} and generated a recurring weekly automation configuration.`,
      highlights: Array.isArray(rawParsed.highlights) ? rawParsed.highlights : [],
      recommended_mode: recommendedMode,
      recurring_config: recurringConfig,
      syllabus_days: syllabusDays,
    };

    return NextResponse.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
