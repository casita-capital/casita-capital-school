import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Json } from 'src/services/supabase/types';
import {
  ApiLinkedAssessment,
  ApiSyllabusWeek,
  CourseSyllabusData,
  MathSyllabusDay,
  PortalIntegrationConfig,
  PortalIntegrationCourseMapping,
  SubjectRecurringConfig,
  createDefaultApiAutoPopulateConfig,
  createDefaultInstructorInfo,
  parseRecurringConfig,
} from 'src/utils/recurring-planner';
import {
  GradebookAssignment,
  MoodleAssignmentMetadata,
  MoodleCategorySummary,
  MoodleCourseGradeReport,
  MoodleGradeItemSummary,
  percentageToLetterGrade,
} from 'src/utils/gradebook-calculator';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_PORTAL_LOGIN_URL = 'https://www.memoriaacademy.com/my-account/';
const DEFAULT_MOODLE_BASE_URL = 'https://mpoa.memoriapress.com';
const DEFAULT_USERNAME = 'audrey.womble';
const DEFAULT_PASSWORD = 'rascallovesme!';

interface MoodleCourseItem {
  id: number;
  shortname: string;
  fullname: string;
  startdate?: number;
  enddate?: number;
}

interface MoodleModuleDate {
  label: string;
  timestamp: number;
}

interface MoodleCourseModule {
  id: number; // cmid
  instance: number;
  name: string;
  modname: string;
  url?: string;
  dates?: MoodleModuleDate[];
}

interface MoodleCourseSection {
  id: number;
  section: number;
  name: string;
  summary: string;
  modules?: MoodleCourseModule[];
}

interface MoodleGradeItemRaw {
  id: number;
  itemname: string | null;
  itemtype: string;
  itemmodule: string | null;
  iteminstance: number;
  cmid?: number;
  graderaw?: number | null;
  gradeformatted?: string;
  grademin?: number;
  grademax?: number;
  rangeformatted?: string;
  percentageformatted?: string;
  weightraw?: number | null;
  weightformatted?: string;
  feedback?: string;
  status?: string;
  gradedatesubmitted?: number | null;
  gradedategraded?: number | null;
}

interface MoodleTableCell {
  class?: string;
  content?: string;
  rowspan?: number;
}

interface MoodleGradeTableRow {
  itemname?: MoodleTableCell;
  weight?: MoodleTableCell;
  grade?: MoodleTableCell;
  range?: MoodleTableCell;
  percentage?: MoodleTableCell;
  lettergrade?: MoodleTableCell;
  contributiontocoursetotal?: MoodleTableCell;
  feedback?: MoodleTableCell;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'school' },
  });
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');
}

function htmlToCleanLines(html: string): string[] {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  return decodeHtmlEntities(withBreaks)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

function stripHtmlInline(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<div class="action-menu[\s\S]*$/i, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  ).trim();
}

function parseNumericFromFormatted(str: string): number | null {
  const cleaned = str.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

async function authenticateMoodle(
  moodleBaseUrl: string,
  username: string,
  password: string
): Promise<string> {
  const cleanBase = moodleBaseUrl.replace(/\/+$/, '');
  const tokenRes = await fetch(`${cleanBase}/login/token.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username,
      password,
      service: 'moodle_mobile_app',
    }),
  });

  const tokenJson: unknown = await tokenRes.json();
  if (!isRecord(tokenJson) || typeof tokenJson.token !== 'string') {
    const errMsg =
      isRecord(tokenJson) && typeof tokenJson.error === 'string'
        ? tokenJson.error
        : 'Failed to authenticate with Memoria Academy portal';
    throw new Error(errMsg);
  }
  return tokenJson.token;
}

async function callMoodleRest(
  moodleBaseUrl: string,
  wstoken: string,
  wsfunction: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const cleanBase = moodleBaseUrl.replace(/\/+$/, '');
  const body = new URLSearchParams({
    wstoken,
    wsfunction,
    moodlewsrestformat: 'json',
    ...params,
  });
  const res = await fetch(`${cleanBase}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return res.json();
}

function buildDefaultCourseMappings(
  courses: MoodleCourseItem[],
  subjects: Array<{ id: string; name: string; recurring_config?: Json | null }>
): PortalIntegrationCourseMapping[] {
  return courses.map((c) => {
    const lowerCourse = `${c.fullname} ${c.shortname}`.toLowerCase();

    // First check if a subject already has this moodle_course_id
    const existingMatched = subjects.find((s) => {
      const cfg = parseRecurringConfig(s.recurring_config, s.name);
      return cfg.course_syllabus?.moodle_course_id === c.id;
    });
    if (existingMatched) {
      return {
        moodle_course_id: c.id,
        course_fullname: c.fullname,
        course_shortname: c.shortname,
        subject_id: existingMatched.id,
        ignored: false,
      };
    }

    // Match Greek Myths D 2026-27 -> Classical Studies
    if (lowerCourse.includes('greek myths') || lowerCourse.includes('cs400')) {
      const classical = subjects.find((s) => s.name.toLowerCase().includes('classical'));
      if (classical) {
        return {
          moodle_course_id: c.id,
          course_fullname: c.fullname,
          course_shortname: c.shortname,
          subject_id: classical.id,
          ignored: false,
        };
      }
    }

    // Match Fable B 2026-27 -> Composition & Grammar
    if (lowerCourse.includes('fable') || lowerCourse.includes('cw400')) {
      const comp = subjects.find(
        (s) =>
          s.name.toLowerCase().includes('composition') ||
          s.name.toLowerCase().includes('grammar')
      );
      if (comp) {
        return {
          moodle_course_id: c.id,
          course_fullname: c.fullname,
          course_shortname: c.shortname,
          subject_id: comp.id,
          ignored: false,
        };
      }
    }

    // Match Latina Christiana A 2026-27 -> Latin
    if (lowerCourse.includes('latina') || lowerCourse.includes('la400')) {
      const latin = subjects.find((s) => s.name.toLowerCase().includes('latin'));
      if (latin) {
        return {
          moodle_course_id: c.id,
          course_fullname: c.fullname,
          course_shortname: c.shortname,
          subject_id: latin.id,
          ignored: false,
        };
      }
    }

    // Past / unmapped courses (e.g., Adventures in Narnia - Spring 2026) default to Ignored / Unmapped
    return {
      moodle_course_id: c.id,
      course_fullname: c.fullname,
      course_shortname: c.shortname,
      subject_id: null,
      ignored: true,
    };
  });
}

function parseDaysAndStructuredLines(lines: string[]): {
  days_breakdown: {
    day_1?: string;
    day_2?: string;
    day_3?: string;
    day_4?: string;
    day_5?: string;
  };
  structured_lines: {
    header_line?: string;
    read_line?: string;
    memorize_line?: string;
    complete_line?: string;
    do_line?: string;
    other_lines: string[];
  };
} {
  const daysBuckets: Record<number, string[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };
  let currentDay = 0;

  let header_line: string | undefined;
  let read_line: string | undefined;
  let memorize_line: string | undefined;
  let complete_line: string | undefined;
  let do_line: string | undefined;
  const other_lines: string[] = [];

  for (const rawLine of lines) {
    const cleanLine = rawLine.replace(/^•\s*/, '').trim();
    if (!header_line && /^week\s+\d+\b/i.test(cleanLine)) {
      header_line = cleanLine;
      continue;
    }

    const dayHeaderMatch = cleanLine.match(/^day\s+([1-5])\s*:?\s*(.*)$/i);
    if (dayHeaderMatch) {
      currentDay = Number(dayHeaderMatch[1]);
      const remainder = dayHeaderMatch[2].trim();
      if (remainder) {
        daysBuckets[currentDay].push(remainder);
      }
      continue;
    }

    if (currentDay >= 1 && currentDay <= 5) {
      daysBuckets[currentDay].push(cleanLine);
    }

    if (/^read\s*:/i.test(cleanLine)) {
      read_line = read_line ? `${read_line}\n${cleanLine}` : cleanLine;
    } else if (/^memorize\s*:/i.test(cleanLine)) {
      memorize_line = memorize_line ? `${memorize_line}\n${cleanLine}` : cleanLine;
    } else if (/^complete\s*:/i.test(cleanLine)) {
      complete_line = complete_line ? `${complete_line}\n${cleanLine}` : cleanLine;
    } else if (/^do\s*:/i.test(cleanLine)) {
      do_line = do_line ? `${do_line}\n${cleanLine}` : cleanLine;
    } else if (currentDay === 0) {
      other_lines.push(cleanLine);
    }
  }

  return {
    days_breakdown: {
      day_1: daysBuckets[1].length > 0 ? daysBuckets[1].join('\n') : undefined,
      day_2: daysBuckets[2].length > 0 ? daysBuckets[2].join('\n') : undefined,
      day_3: daysBuckets[3].length > 0 ? daysBuckets[3].join('\n') : undefined,
      day_4: daysBuckets[4].length > 0 ? daysBuckets[4].join('\n') : undefined,
      day_5: daysBuckets[5].length > 0 ? daysBuckets[5].join('\n') : undefined,
    },
    structured_lines: {
      header_line,
      read_line,
      memorize_line,
      complete_line,
      do_line,
      other_lines,
    },
  };
}

function formatTimestampInPortalTz(timestampSeconds: number): string {
  // Memoria Academy portal times (e.g. 12:01 AM ET open, 11:55 PM / 11:59 PM ET close) are in US Eastern Time
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestampSeconds * 1000));
}

function parseSectionDateRange(sectionTitle: string): {
  mondayStartDate: string;
  fridayCloseDate: string;
} | null {
  // Section titles look like "September 6 - September 12" or "November 29 - December 5"
  const rangeMatch = sectionTitle.match(
    /([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)?\s*(\d{1,2})/
  );
  if (!rangeMatch) return null;

  const startMonthName = rangeMatch[1];
  const startDay = Number(rangeMatch[2]);
  const endMonthName = rangeMatch[3] || startMonthName;
  const endDay = Number(rangeMatch[4]);

  const monthMap: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };

  const startMonthNum = monthMap[startMonthName.toLowerCase()];
  const endMonthNum = monthMap[endMonthName.toLowerCase()];
  if (!startMonthNum || !endMonthNum) return null;

  // Academic year 2026-27: Aug-Dec is 2026, Jan-Jun is 2027
  const startYear = startMonthNum >= 8 ? 2026 : 2027;
  const endYear = endMonthNum >= 8 ? 2026 : 2027;

  // Section header is Sunday..Saturday; Monday is Sunday + 1 day, Friday is Saturday - 1 day
  const sunDate = new Date(Date.UTC(startYear, startMonthNum - 1, startDay));
  sunDate.setUTCDate(sunDate.getUTCDate() + 1);
  const monY = sunDate.getUTCFullYear();
  const monM = String(sunDate.getUTCMonth() + 1).padStart(2, '0');
  const monD = String(sunDate.getUTCDate()).padStart(2, '0');

  const satDate = new Date(Date.UTC(endYear, endMonthNum - 1, endDay));
  satDate.setUTCDate(satDate.getUTCDate() - 1);
  const friY = satDate.getUTCFullYear();
  const friM = String(satDate.getUTCMonth() + 1).padStart(2, '0');
  const friD = String(satDate.getUTCDate()).padStart(2, '0');

  return {
    mondayStartDate: `${monY}-${monM}-${monD}`,
    fridayCloseDate: `${friY}-${friM}-${friD}`,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: subData } = await supabase
      .from('subjects')
      .select('id, name, color, course_code, recurring_config, grading_config')
      .order('sort_order', { ascending: true });

    const subjects = (subData || []) as Array<{
      id: string;
      name: string;
      color: string;
      course_code?: string;
      recurring_config?: Json | null;
      grading_config?: Json | null;
    }>;

    // Look for stored portal_integration config on any subject's grading_config
    let storedIntegration: PortalIntegrationConfig | null = null;
    for (const s of subjects) {
      if (isRecord(s.grading_config) && isRecord(s.grading_config.portal_integration)) {
        const pi = s.grading_config.portal_integration;
        const rawMappings = Array.isArray(pi.course_mappings) ? pi.course_mappings : [];
        const course_mappings: PortalIntegrationCourseMapping[] = [];
        for (const rm of rawMappings) {
          if (!isRecord(rm) || typeof rm.moodle_course_id !== 'number') continue;
          course_mappings.push({
            moodle_course_id: rm.moodle_course_id,
            course_fullname:
              typeof rm.course_fullname === 'string' ? rm.course_fullname : '',
            course_shortname:
              typeof rm.course_shortname === 'string' ? rm.course_shortname : '',
            subject_id: typeof rm.subject_id === 'string' ? rm.subject_id : null,
            ignored: typeof rm.ignored === 'boolean' ? rm.ignored : false,
          });
        }
        storedIntegration = {
          portal_login_url:
            typeof pi.portal_login_url === 'string'
              ? pi.portal_login_url
              : DEFAULT_PORTAL_LOGIN_URL,
          moodle_base_url:
            typeof pi.moodle_base_url === 'string'
              ? pi.moodle_base_url
              : DEFAULT_MOODLE_BASE_URL,
          username: typeof pi.username === 'string' ? pi.username : DEFAULT_USERNAME,
          password: typeof pi.password === 'string' ? pi.password : DEFAULT_PASSWORD,
          last_synced_at:
            typeof pi.last_synced_at === 'string' ? pi.last_synced_at : undefined,
          student_fullname:
            typeof pi.student_fullname === 'string' ? pi.student_fullname : undefined,
          moodle_user_id:
            typeof pi.moodle_user_id === 'number' ? pi.moodle_user_id : undefined,
          course_mappings,
        };
        break;
      }
    }

    if (!storedIntegration) {
      storedIntegration = {
        portal_login_url: DEFAULT_PORTAL_LOGIN_URL,
        moodle_base_url: DEFAULT_MOODLE_BASE_URL,
        username: DEFAULT_USERNAME,
        password: DEFAULT_PASSWORD,
        course_mappings: [],
      };
    }

    return NextResponse.json({
      ok: true,
      integration: storedIntegration,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to load integration' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const bodyRaw: unknown = await req.json().catch(() => ({}));
    const body = isRecord(bodyRaw) ? bodyRaw : {};

    const action = typeof body.action === 'string' ? body.action : 'sync_courses';
    const portalLoginUrl =
      typeof body.portal_login_url === 'string' && body.portal_login_url.trim()
        ? body.portal_login_url.trim()
        : DEFAULT_PORTAL_LOGIN_URL;
    const moodleBaseUrl =
      typeof body.moodle_base_url === 'string' && body.moodle_base_url.trim()
        ? body.moodle_base_url.trim()
        : DEFAULT_MOODLE_BASE_URL;
    const username =
      typeof body.username === 'string' && body.username.trim()
        ? body.username.trim()
        : DEFAULT_USERNAME;
    const password =
      typeof body.password === 'string' && body.password.trim()
        ? body.password.trim()
        : DEFAULT_PASSWORD;

    const supabase = getSupabaseAdmin();
    const { data: subData, error: subErr } = await supabase
      .from('subjects')
      .select('*')
      .order('sort_order', { ascending: true });

    if (subErr || !subData) {
      return NextResponse.json(
        { ok: false, error: subErr?.message || 'Failed to load subjects from database' },
        { status: 500 }
      );
    }

    const subjects = subData as Array<{
      id: string;
      name: string;
      color: string;
      sort_order: number;
      course_code?: string;
      link?: string | null;
      recurring_config?: Json | null;
      grading_config?: Json | null;
    }>;

    // 1. Authenticate with Moodle Portal
    const token = await authenticateMoodle(moodleBaseUrl, username, password);

    // 2. Get Site Info (user ID & student name)
    const siteInfoRaw = await callMoodleRest(
      moodleBaseUrl,
      token,
      'core_webservice_get_site_info'
    );
    if (!isRecord(siteInfoRaw) || typeof siteInfoRaw.userid !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'Failed to retrieve student profile from Memoria portal' },
        { status: 500 }
      );
    }
    const moodleUserId = siteInfoRaw.userid;
    const studentFullname =
      typeof siteInfoRaw.fullname === 'string' ? siteInfoRaw.fullname : username;

    // 3. Get Enrolled Courses
    const coursesRaw = await callMoodleRest(
      moodleBaseUrl,
      token,
      'core_enrol_get_users_courses',
      { userid: String(moodleUserId) }
    );
    const enrolledCourses: MoodleCourseItem[] = [];
    if (Array.isArray(coursesRaw)) {
      for (const c of coursesRaw) {
        if (!isRecord(c) || typeof c.id !== 'number') continue;
        enrolledCourses.push({
          id: c.id,
          shortname: typeof c.shortname === 'string' ? c.shortname : `COURSE-${c.id}`,
          fullname: typeof c.fullname === 'string' ? c.fullname : `Course ${c.id}`,
          startdate: typeof c.startdate === 'number' ? c.startdate : undefined,
          enddate: typeof c.enddate === 'number' ? c.enddate : undefined,
        });
      }
    }

    const defaultMappings = buildDefaultCourseMappings(enrolledCourses, subjects);

    // Parse user-supplied course_mappings if provided
    let activeMappings: PortalIntegrationCourseMapping[] = defaultMappings;
    if (Array.isArray(body.course_mappings) && body.course_mappings.length > 0) {
      const providedMap = new Map<number, { subject_id: string | null; ignored: boolean }>();
      for (const item of body.course_mappings) {
        if (!isRecord(item) || typeof item.moodle_course_id !== 'number') continue;
        const subId =
          typeof item.subject_id === 'string' && item.subject_id !== 'ignored' && item.subject_id !== ''
            ? item.subject_id
            : null;
        const ignored =
          typeof item.ignored === 'boolean' ? item.ignored : subId === null;
        providedMap.set(item.moodle_course_id, { subject_id: subId, ignored });
      }
      activeMappings = defaultMappings.map((dm) => {
        const override = providedMap.get(dm.moodle_course_id);
        if (!override) return dm;
        return {
          ...dm,
          subject_id: override.subject_id,
          ignored: override.ignored,
        };
      });
    }

    if (action === 'discover_courses') {
      return NextResponse.json({
        ok: true,
        moodle_user_id: moodleUserId,
        student_fullname: studentFullname,
        courses: enrolledCourses,
        course_mappings: activeMappings,
      });
    }

    // 4. Sync Mapped Courses (Syllabus Weeks + Linked Assessments + Gradebook Report + Assignments)
    const nowIso = new Date().toISOString();
    const { data: existingAssignData } = await supabase.from('assignments').select('*');
    const existingAssignments = (existingAssignData || []) as unknown as GradebookAssignment[];

    const syncedCoursesSummary: Array<{
      moodle_course_id: number;
      official_course_name: string;
      subject_id: string;
      subject_name: string;
      weeks_count: number;
      graded_items_count: number;
      course_total_percentage: number | null;
      assignments_upserted: number;
    }> = [];

    const integrationSnapshot: PortalIntegrationConfig = {
      portal_login_url: portalLoginUrl,
      moodle_base_url: moodleBaseUrl,
      username,
      password,
      last_synced_at: nowIso,
      student_fullname: studentFullname,
      moodle_user_id: moodleUserId,
      course_mappings: activeMappings,
    };

    for (const mapping of activeMappings) {
      if (mapping.ignored || !mapping.subject_id) continue;
      const targetSubject = subjects.find((s) => s.id === mapping.subject_id);
      if (!targetSubject) continue;

      const courseIdStr = String(mapping.moodle_course_id);

      // Fetch Course Contents, Grade Items, Grade Table, and Course Contacts in parallel
      const [sectionsRaw, gradeItemsResp, gradeTableResp, courseDetailsResp] = await Promise.all([
        callMoodleRest(moodleBaseUrl, token, 'core_course_get_contents', {
          courseid: courseIdStr,
        }),
        callMoodleRest(moodleBaseUrl, token, 'gradereport_user_get_grade_items', {
          courseid: courseIdStr,
          userid: String(moodleUserId),
        }),
        callMoodleRest(moodleBaseUrl, token, 'gradereport_user_get_grades_table', {
          courseid: courseIdStr,
          userid: String(moodleUserId),
        }),
        callMoodleRest(moodleBaseUrl, token, 'core_course_get_courses_by_field', {
          field: 'id',
          value: courseIdStr,
        }).catch(() => null),
      ]);

      // Parse Grade Items by cmid and by itemname
      const gradeItemsByCmid = new Map<number, MoodleGradeItemRaw>();
      const gradeItemsById = new Map<number, MoodleGradeItemRaw>();
      if (
        isRecord(gradeItemsResp) &&
        Array.isArray(gradeItemsResp.usergrades) &&
        gradeItemsResp.usergrades.length > 0
      ) {
        const firstUserGrade = gradeItemsResp.usergrades[0];
        if (isRecord(firstUserGrade) && Array.isArray(firstUserGrade.gradeitems)) {
          for (const gi of firstUserGrade.gradeitems) {
            if (!isRecord(gi) || typeof gi.id !== 'number') continue;
            const parsedGi: MoodleGradeItemRaw = {
              id: gi.id,
              itemname: typeof gi.itemname === 'string' ? decodeHtmlEntities(gi.itemname) : null,
              itemtype: typeof gi.itemtype === 'string' ? gi.itemtype : 'mod',
              itemmodule: typeof gi.itemmodule === 'string' ? gi.itemmodule : null,
              iteminstance: typeof gi.iteminstance === 'number' ? gi.iteminstance : 0,
              cmid: typeof gi.cmid === 'number' ? gi.cmid : undefined,
              graderaw: typeof gi.graderaw === 'number' ? gi.graderaw : null,
              gradeformatted: typeof gi.gradeformatted === 'string' ? gi.gradeformatted : '-',
              grademin: typeof gi.grademin === 'number' ? gi.grademin : 0,
              grademax: typeof gi.grademax === 'number' ? gi.grademax : 100,
              rangeformatted:
                typeof gi.rangeformatted === 'string' ? gi.rangeformatted : '0–100',
              percentageformatted:
                typeof gi.percentageformatted === 'string' ? gi.percentageformatted : '-',
              weightraw: typeof gi.weightraw === 'number' ? gi.weightraw : null,
              weightformatted:
                typeof gi.weightformatted === 'string' ? gi.weightformatted : '-',
              feedback:
                typeof gi.feedback === 'string' && stripHtmlInline(gi.feedback).length > 0
                  ? stripHtmlInline(gi.feedback)
                  : undefined,
              status: typeof gi.status === 'string' ? gi.status : undefined,
              gradedatesubmitted:
                typeof gi.gradedatesubmitted === 'number' && gi.gradedatesubmitted > 0
                  ? gi.gradedatesubmitted
                  : null,
              gradedategraded:
                typeof gi.gradedategraded === 'number' && gi.gradedategraded > 0
                  ? gi.gradedategraded
                  : null,
            };
            if (typeof parsedGi.cmid === 'number') {
              gradeItemsByCmid.set(parsedGi.cmid, parsedGi);
            }
            gradeItemsById.set(parsedGi.id, parsedGi);
          }
        }
      }

      // Parse Grade Table Hierarchy (Categories, Category Totals, Contributions, Course Total)
      const categoriesList: MoodleCategorySummary[] = [];
      const tableMetaByCmid = new Map<
        number,
        {
          category_name: string;
          weight_formatted: string;
          weight_numeric: number | null;
          grade_formatted: string;
          percentage_formatted: string;
          contribution_formatted: string;
          contribution_numeric: number | null;
          is_ungraded_bucket: boolean;
        }
      >();
      let courseTotalPercentage: number | null = null;
      let courseTotalFormatted = '-';

      // Also extract course total fallback from gradeitems (itemtype === 'course')
      let courseItemGradeRaw: number | null = null;
      if (
        isRecord(gradeItemsResp) &&
        Array.isArray(gradeItemsResp.usergrades) &&
        gradeItemsResp.usergrades.length > 0
      ) {
        const firstUserGrade = gradeItemsResp.usergrades[0];
        if (isRecord(firstUserGrade) && Array.isArray(firstUserGrade.gradeitems)) {
          for (const gi of firstUserGrade.gradeitems) {
            if (isRecord(gi) && gi.itemtype === 'course' && typeof gi.graderaw === 'number') {
              courseItemGradeRaw = Number(gi.graderaw.toFixed(2));
            }
          }
        }
      }

      const tableOrderedCmids: number[] = [];

      if (
        isRecord(gradeTableResp) &&
        Array.isArray(gradeTableResp.tables) &&
        gradeTableResp.tables.length > 0
      ) {
        const firstTable = gradeTableResp.tables[0];
        if (isRecord(firstTable) && Array.isArray(firstTable.tabledata)) {
          let currentCategory = 'Current Quizzes';
          for (const rawRow of firstTable.tabledata) {
            if (!isRecord(rawRow) || !isRecord(rawRow.itemname)) continue;
            const row = rawRow as unknown as MoodleGradeTableRow;
            const cls = row.itemname?.class || '';
            const rawHtml = row.itemname?.content || '';
            const cleanName = stripHtmlInline(
              rawHtml.replace(/<div class="gradeitemdescription[\s\S]*$/i, '')
            );

            const wtStr = stripHtmlInline(row.weight?.content || '-');
            const grStr = stripHtmlInline(row.grade?.content || '-');
            const pctStr = stripHtmlInline(row.percentage?.content || '-');
            const contribStr = stripHtmlInline(row.contributiontocoursetotal?.content || '-');

            // IMPORTANT: Check 'bagg' (matches both 'baggb' and 'baggt') BEFORE 'category'
            if (cls.includes('bagg')) {
              const strippedAgg = cleanName.replace(/^Aggregation\s+/i, '').trim();
              const isCourseTotal = strippedAgg.toLowerCase().includes('course total');
              const grNum = parseNumericFromFormatted(grStr);
              const pctNum = parseNumericFromFormatted(pctStr) ?? grNum;
              const wtNum = parseNumericFromFormatted(wtStr) ?? 0;

              if (isCourseTotal) {
                courseTotalPercentage = pctNum ?? courseItemGradeRaw;
                courseTotalFormatted =
                  grStr !== '-'
                    ? `${grStr}%`
                    : courseItemGradeRaw !== null
                    ? `${courseItemGradeRaw.toFixed(2)}%`
                    : '-';
              } else {
                const catLabel =
                  strippedAgg.replace(/\s+total$/i, '').trim() || currentCategory;
                const isUngraded = catLabel.toLowerCase().includes('ungraded');
                const existingCatIdx = categoriesList.findIndex(
                  (c) => c.category_name.toLowerCase() === catLabel.toLowerCase()
                );
                const catSummary: MoodleCategorySummary = {
                  category_name:
                    existingCatIdx >= 0
                      ? categoriesList[existingCatIdx].category_name
                      : catLabel,
                  weight_formatted:
                    wtStr && wtStr !== '-'
                      ? wtStr
                      : isUngraded
                      ? '0.00 %'
                      : '100.00 %',
                  weight_numeric: isUngraded ? 0 : wtNum,
                  grade_formatted: grStr || '-',
                  percentage_numeric: pctNum,
                  is_empty: wtStr.toLowerCase().includes('empty') || grStr === '-',
                  is_ungraded_bucket: isUngraded,
                };
                if (existingCatIdx >= 0) {
                  categoriesList[existingCatIdx] = catSummary;
                } else {
                  categoriesList.push(catSummary);
                }
              }
            } else if (cls.includes('category')) {
              // Skip top-level course name category wrapper
              if (
                cleanName.toLowerCase() !== mapping.course_fullname.toLowerCase() &&
                cleanName.length > 0
              ) {
                currentCategory = cleanName;
                const isUngraded = currentCategory.toLowerCase().includes('ungraded');
                const wtNum = parseNumericFromFormatted(wtStr);
                if (
                  !categoriesList.some(
                    (c) => c.category_name.toLowerCase() === currentCategory.toLowerCase()
                  )
                ) {
                  categoriesList.push({
                    category_name: currentCategory,
                    weight_formatted: isUngraded
                      ? '0.00 %'
                      : wtStr && wtStr !== '-'
                      ? wtStr
                      : '0.00 %',
                    weight_numeric: isUngraded ? 0 : wtNum ?? 0,
                    grade_formatted: '-',
                    percentage_numeric: null,
                    is_empty: true,
                    is_ungraded_bucket: isUngraded,
                  });
                }
              }
            } else if (cls.includes('item')) {
              const idMatch = rawHtml.match(/[?&]id=(\d+)/);
              const itemIdMatch = rawHtml.match(/[?&]itemid=(\d+)/);
              let resolvedCmid: number | null = idMatch ? Number(idMatch[1]) : null;
              if (!resolvedCmid && itemIdMatch) {
                const gi = gradeItemsById.get(Number(itemIdMatch[1]));
                if (gi?.cmid) resolvedCmid = gi.cmid;
              }
              if (!resolvedCmid) {
                const strippedModPrefix = cleanName
                  .replace(/^(Quiz|Assignment|Forum|External tool)\s+/i, '')
                  .trim();
                for (const [cmidKey, giVal] of gradeItemsByCmid.entries()) {
                  if (
                    giVal.itemname &&
                    giVal.itemname.toLowerCase() === strippedModPrefix.toLowerCase()
                  ) {
                    resolvedCmid = cmidKey;
                    break;
                  }
                }
              }

              const isUngraded = currentCategory.toLowerCase().includes('ungraded');
              if (resolvedCmid) {
                if (!tableOrderedCmids.includes(resolvedCmid)) {
                  tableOrderedCmids.push(resolvedCmid);
                }
                const hasItemGrade = grStr !== '-' && grStr !== '';
                tableMetaByCmid.set(resolvedCmid, {
                  category_name: currentCategory,
                  weight_formatted:
                    isUngraded && !hasItemGrade ? '0.00 %' : wtStr || '-',
                  weight_numeric:
                    isUngraded && !hasItemGrade ? 0 : parseNumericFromFormatted(wtStr),
                  grade_formatted: grStr || '-',
                  percentage_formatted: pctStr || (hasItemGrade ? `${grStr} %` : '-'),
                  contribution_formatted:
                    isUngraded && !hasItemGrade ? '-' : contribStr || '-',
                  contribution_numeric:
                    isUngraded && !hasItemGrade
                      ? null
                      : parseNumericFromFormatted(contribStr),
                  is_ungraded_bucket: isUngraded,
                });
              }
            }
          }
        }
      }

      if (courseTotalPercentage === null && courseItemGradeRaw !== null) {
        courseTotalPercentage = courseItemGradeRaw;
        courseTotalFormatted = `${courseItemGradeRaw.toFixed(2)}%`;
      }

      // Parse Course Sections into Numbered Syllabus Weeks
      const existingRec = parseRecurringConfig(
        targetSubject.recurring_config,
        targetSubject.name
      );
      const existingOverridesByWeek = new Map<number, string>();
      if (existingRec.course_syllabus?.weeks) {
        for (const w of existingRec.course_syllabus.weeks) {
          if (w.custom_override_text) {
            existingOverridesByWeek.set(w.week_number, w.custom_override_text);
          }
        }
      }

      const apiWeeks: ApiSyllabusWeek[] = [];
      const legacySyllabusDays: MathSyllabusDay[] = [];
      const cmidToWeekMap = new Map<number, { week_number: number; section_title: string }>();
      const modDatesByCmid = new Map<
        number,
        { open_date: string | null; due_date: string | null; due_timestamp: number | null }
      >();

      const sectionsList: MoodleCourseSection[] = [];
      if (Array.isArray(sectionsRaw)) {
        for (const s of sectionsRaw) {
          if (!isRecord(s) || typeof s.section !== 'number') continue;
          const rawMods = Array.isArray(s.modules) ? s.modules : [];
          const modules: MoodleCourseModule[] = [];
          for (const m of rawMods) {
            if (!isRecord(m) || typeof m.id !== 'number') continue;
            const rawDates = Array.isArray(m.dates) ? m.dates : [];
            const dates: MoodleModuleDate[] = [];
            let parsedOpen: string | null = null;
            let parsedDue: string | null = null;
            let parsedDueTs: number | null = null;

            for (const d of rawDates) {
              if (
                isRecord(d) &&
                typeof d.label === 'string' &&
                typeof d.timestamp === 'number'
              ) {
                dates.push({ label: d.label, timestamp: d.timestamp });
                const nyDate = formatTimestampInPortalTz(d.timestamp);
                const yr = Number(nyDate.slice(0, 4));
                if (yr >= 2026) {
                  if (/open/i.test(d.label)) {
                    parsedOpen = nyDate;
                  } else if (/close|due/i.test(d.label)) {
                    parsedDue = nyDate;
                    parsedDueTs = d.timestamp;
                  }
                }
              }
            }

            if (parsedOpen || parsedDue) {
              modDatesByCmid.set(m.id, {
                open_date: parsedOpen,
                due_date: parsedDue,
                due_timestamp: parsedDueTs,
              });
            }

            modules.push({
              id: m.id,
              instance: typeof m.instance === 'number' ? m.instance : 0,
              name: typeof m.name === 'string' ? decodeHtmlEntities(m.name) : 'Module',
              modname: typeof m.modname === 'string' ? m.modname : 'resource',
              url: typeof m.url === 'string' ? m.url : undefined,
              dates,
            });
          }

          sectionsList.push({
            id: typeof s.id === 'number' ? s.id : s.section,
            section: s.section,
            name: typeof s.name === 'string' ? decodeHtmlEntities(s.name) : `Section ${s.section}`,
            summary: typeof s.summary === 'string' ? s.summary : '',
            modules,
          });
        }
      }

      const KNOWN_BREAK_SECTION_TITLES = [
        'november 22 - november 28',
        'december 20 - december 26',
        'december 27 - january 2',
        'march 21 - march 27',
      ];

      let runningWeekNumber = 0;
      for (const sec of sectionsList) {
        if (sec.section === 0) continue; // Skip Section 0 (General Resources)

        const lines = htmlToCleanLines(sec.summary);
        const rawSummaryText = lines.join('\n');
        const assessmentMods = (sec.modules || []).filter(
          (m) => m.modname === 'quiz' || m.modname === 'assign'
        );

        const lowerSecTitle = sec.name.trim().toLowerCase();
        const isKnownBreakDate = KNOWN_BREAK_SECTION_TITLES.some((b) =>
          lowerSecTitle.includes(b)
        );
        const isBreakSummary =
          /break|vacation|easter|christmas|thanksgiving/i.test(rawSummaryText) &&
          !/^week\s+\d+/im.test(rawSummaryText) &&
          assessmentMods.length === 0;

        if ((isKnownBreakDate || isBreakSummary) && assessmentMods.length === 0) {
          continue;
        }

        // Determine week number from "Week X" in summary or increment sequentially (1..34)
        const weekMatch = rawSummaryText.match(/\bWeek\s+(\d+)\b/i);
        const weekNum = weekMatch ? Number(weekMatch[1]) : runningWeekNumber + 1;
        if (weekNum > 34 && lines.length === 0 && assessmentMods.length === 0) {
          continue;
        }
        runningWeekNumber = Math.max(runningWeekNumber, weekNum);

        const { days_breakdown, structured_lines } = parseDaysAndStructuredLines(lines);
        const sectionDateRange = parseSectionDateRange(sec.name);

        const linkedAssessments: ApiLinkedAssessment[] = [];
        for (const mod of assessmentMods) {
          cmidToWeekMap.set(mod.id, { week_number: weekNum, section_title: sec.name });

          const gi = gradeItemsByCmid.get(mod.id);
          const tm = tableMetaByCmid.get(mod.id);
          const extractedDates = modDatesByCmid.get(mod.id);

          const openDateStr: string | null =
            extractedDates?.open_date || sectionDateRange?.mondayStartDate || null;
          const dueDateStr: string | null =
            extractedDates?.due_date || sectionDateRange?.fridayCloseDate || null;
          const dueTimestamp: number | null = extractedDates?.due_timestamp ?? null;

          const gradeRaw =
            gi && typeof gi.graderaw === 'number' && !Number.isNaN(gi.graderaw)
              ? Number(gi.graderaw.toFixed(2))
              : tm ? parseNumericFromFormatted(tm.grade_formatted) : null;
          const gradeMax = gi && typeof gi.grademax === 'number' ? gi.grademax : 100;
          const hasSubmittedTimestamp =
            Boolean(gi && typeof gi.gradedatesubmitted === 'number' && gi.gradedatesubmitted > 0);

          const statusLabel: 'graded' | 'submitted' | 'upcoming' | 'open' =
            gradeRaw !== null
              ? 'graded'
              : hasSubmittedTimestamp
              ? 'submitted'
              : openDateStr && openDateStr <= nowIso.split('T')[0]
              ? 'open'
              : 'upcoming';

          linkedAssessments.push({
            cmid: mod.id,
            instance_id: mod.instance,
            name: mod.name,
            modname: mod.modname,
            url: mod.url,
            open_date: openDateStr,
            due_date: dueDateStr,
            due_timestamp: dueTimestamp,
            grade_raw: gradeRaw,
            grade_max: gradeMax,
            percentage_formatted:
              tm?.percentage_formatted ||
              gi?.percentageformatted ||
              (gradeRaw !== null ? `${gradeRaw.toFixed(2)} %` : null),
            weight_raw: tm?.weight_numeric ?? gi?.weightraw ?? null,
            weight_formatted: tm?.weight_formatted || gi?.weightformatted || null,
            contribution_formatted: tm?.contribution_formatted || null,
            moodle_category: tm?.category_name || 'Current Quizzes',
            is_ungraded_bucket: tm?.is_ungraded_bucket || false,
            feedback: gi?.feedback || null,
            status_label: statusLabel,
          });
        }

        apiWeeks.push({
          week_number: weekNum,
          section_num: sec.section,
          section_title: sec.name,
          raw_summary: rawSummaryText,
          custom_override_text: existingOverridesByWeek.get(weekNum),
          days_breakdown,
          structured_lines,
          linked_assessments: linkedAssessments,
        });

        legacySyllabusDays.push({
          id: `moodle-${mapping.moodle_course_id}-wk-${weekNum}`,
          day_number: weekNum,
          semester: weekNum <= 16 ? 1 : 2,
          workbook:
            structured_lines.complete_line ||
            days_breakdown.day_1?.split('\n')[0] ||
            lines[1] ||
            '',
          textbook: structured_lines.read_line || '',
          topic: `${ structured_lines.header_line || `Week ${weekNum}` } (${sec.name})`,
          materials: structured_lines.memorize_line || '',
          fast_facts:
            linkedAssessments.map((a) => a.name).join(', ') ||
            structured_lines.do_line ||
            '',
          notes: rawSummaryText,
        });
      }

      // Build complete MoodleGradeItemSummary list in exact Moodle Grade Table order
      const orderedCmids = [
        ...tableOrderedCmids,
        ...Array.from(gradeItemsByCmid.keys()).filter(
          (cmidKey) => !tableOrderedCmids.includes(cmidKey)
        ),
      ];

      const reportItems: MoodleGradeItemSummary[] = [];
      for (const cmid of orderedCmids) {
        const gi = gradeItemsByCmid.get(cmid);
        if (!gi) continue;
        const tm = tableMetaByCmid.get(cmid);
        const wkInfo = cmidToWeekMap.get(cmid);
        const gradeRaw =
          typeof gi.graderaw === 'number' && !Number.isNaN(gi.graderaw)
            ? Number(gi.graderaw.toFixed(2))
            : tm ? parseNumericFromFormatted(tm.grade_formatted) : null;

        // Find open_date and due_date from apiWeeks or modDatesByCmid
        let itemOpenDate: string | null = modDatesByCmid.get(cmid)?.open_date ?? null;
        let itemDueDate: string | null = modDatesByCmid.get(cmid)?.due_date ?? null;
        for (const w of apiWeeks) {
          const foundAss = w.linked_assessments.find((la) => la.cmid === cmid);
          if (foundAss) {
            itemOpenDate = foundAss.open_date;
            itemDueDate = foundAss.due_date;
            break;
          }
        }

        reportItems.push({
          cmid,
          item_id: gi.id,
          item_name: gi.itemname || `Item ${cmid}`,
          item_module: gi.itemmodule || 'quiz',
          category_name: tm?.category_name || 'Current Quizzes',
          week_number: wkInfo?.week_number ?? null,
          weight_formatted: tm?.weight_formatted || gi.weightformatted || '-',
          weight_numeric: tm?.weight_numeric ?? gi.weightraw ?? null,
          grade_formatted:
            gradeRaw !== null ? gradeRaw.toFixed(2) : tm?.grade_formatted || '-',
          grade_raw: gradeRaw,
          grade_max: gi.grademax ?? 100,
          range_formatted: decodeHtmlEntities(gi.rangeformatted || '0–100'),
          percentage_formatted:
            gradeRaw !== null
              ? `${gradeRaw.toFixed(2)} %`
              : tm?.percentage_formatted || '-',
          contribution_formatted: tm?.contribution_formatted || '-',
          contribution_numeric: tm?.contribution_numeric ?? null,
          feedback: gi.feedback ? stripHtmlInline(gi.feedback) : null,
          is_ungraded_bucket: tm?.is_ungraded_bucket || false,
          open_date: itemOpenDate,
          due_date: itemDueDate,
          submitted_at:
            typeof gi.gradedatesubmitted === 'number' && gi.gradedatesubmitted > 0
              ? new Date(gi.gradedatesubmitted * 1000).toISOString()
              : null,
        });
      }

      // Sort grade report items chronologically by week_number ascending (nulls last), then due_date ascending
      reportItems.sort((a, b) => {
        const wa = typeof a.week_number === 'number' ? a.week_number : Number.MAX_SAFE_INTEGER;
        const wb = typeof b.week_number === 'number' ? b.week_number : Number.MAX_SAFE_INTEGER;
        if (wa !== wb) return wa - wb;
        const da = a.due_date || '9999-12-31';
        const db = b.due_date || '9999-12-31';
        if (da !== db) return da.localeCompare(db);
        return (a.cmid ?? a.item_id ?? 0) - (b.cmid ?? b.item_id ?? 0);
      });

      const moodleGradeReport: MoodleCourseGradeReport = {
        moodle_course_id: mapping.moodle_course_id,
        official_course_name: mapping.course_fullname,
        course_shortname: mapping.course_shortname,
        course_total_percentage: courseTotalPercentage,
        course_total_formatted: courseTotalFormatted,
        last_synced_at: nowIso,
        categories: categoriesList,
        items: reportItems,
      };

      // Extract Teacher Contact Info & Live Classroom Link from courseDetailsResp + Section 0
      let apiTeacherName = '';
      if (isRecord(courseDetailsResp) && Array.isArray(courseDetailsResp.courses)) {
        const firstCourse = courseDetailsResp.courses[0];
        if (isRecord(firstCourse) && Array.isArray(firstCourse.contacts)) {
          const firstContact = firstCourse.contacts[0];
          if (isRecord(firstContact) && typeof firstContact.fullname === 'string') {
            apiTeacherName = decodeHtmlEntities(firstContact.fullname).trim();
          }
        }
      }

      const sec0 = sectionsList.find((s) => s.section === 0);
      const sec0RawHtml = sec0?.summary || '';
      const sec0Lines = htmlToCleanLines(sec0RawHtml);
      const sec0CleanText = sec0Lines.join('\n');

      if (!apiTeacherName) {
        const teacherMatch = sec0CleanText.match(/Teacher:\s*([^\n\r]+)/i);
        if (teacherMatch) {
          apiTeacherName = teacherMatch[1].trim();
        }
      }

      const emailMatch =
        sec0RawHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) ||
        sec0CleanText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const apiTeacherEmail = emailMatch ? emailMatch[0].trim() : '';

      const classTimeMatch = sec0CleanText.match(/Class\s*Time:\s*([^\n\r]+)/i);
      const apiClassTimeNotes = classTimeMatch
        ? `Class Time: ${classTimeMatch[1].trim()}`
        : '';

      const classroomHrefMatch = sec0RawHtml.match(
        /href=["'](https?:\/\/[^"']*(?:adobeconnect\.com|zoom\.us)[^"']*)["']/i
      );
      const apiLiveClassroomLink = classroomHrefMatch ? classroomHrefMatch[1].trim() : '';

      const defaultInst = createDefaultInstructorInfo(
        targetSubject.name,
        true,
        apiTeacherName || existingRec.course_syllabus?.teacher_name
      );

      const resolvedTeacherName =
        apiTeacherName ||
        existingRec.instructor_info?.teacher_name ||
        defaultInst.teacher_name;
      const resolvedTeacherEmail =
        apiTeacherEmail ||
        existingRec.instructor_info?.teacher_email ||
        defaultInst.teacher_email;
      const resolvedClassTimeNotes =
        apiClassTimeNotes ||
        (existingRec.instructor_info?.teacher_contact_notes &&
        existingRec.instructor_info.teacher_contact_notes !==
          'Memoria Academy Portal (mpoa.memoriapress.com)'
          ? existingRec.instructor_info.teacher_contact_notes
          : defaultInst.teacher_contact_notes);
      const resolvedLiveClassroomLink =
        apiLiveClassroomLink || targetSubject.link || null;

      // Build updated CourseSyllabusData (preserving existing api_auto_populate rules if already configured)
      const autoPopulateCfg =
        existingRec.course_syllabus?.api_auto_populate ||
        createDefaultApiAutoPopulateConfig(targetSubject.name, mapping.course_fullname);

      const updatedCourseSyllabus: CourseSyllabusData = {
        id: existingRec.course_syllabus?.id || `syllabus-${mapping.moodle_course_id}`,
        course_title: mapping.course_fullname,
        official_course_name: mapping.course_fullname,
        source_type: 'api_sync',
        moodle_course_id: mapping.moodle_course_id,
        moodle_course_shortname: mapping.course_shortname,
        portal_url: moodleBaseUrl,
        last_synced_at: nowIso,
        teacher_name: resolvedTeacherName || undefined,
        summary: `Synced from Memoria Academy Portal (${apiWeeks.length} weeks, ${reportItems.length} assessments, ${reportItems.filter((i) => i.grade_raw !== null).length} graded)`,
        uploaded_at: nowIso,
        days: legacySyllabusDays,
        weeks: apiWeeks,
        api_auto_populate: autoPopulateCfg,
      };

      // Ensure base_week_date '2026-10-12' maps to Week 6 (Oct 11 - Oct 17 in Memoria Academy)
      const updatedRecurringConfig: SubjectRecurringConfig = {
        ...existingRec,
        enabled: true,
        base_week_date: '2026-10-12',
        base_week_num: 6,
        course_syllabus: updatedCourseSyllabus,
        instructor_info: {
          provider_type: 'external',
          outside_entity_name:
            existingRec.instructor_info?.outside_entity_name?.trim() || 'Memoria Academy',
          teacher_name: resolvedTeacherName,
          teacher_email: resolvedTeacherEmail,
          teacher_phone: existingRec.instructor_info?.teacher_phone || '',
          teacher_contact_notes: resolvedClassTimeNotes,
        },
      };

      // Configure category_weights in grading_config to match Moodle's exact category weights!
      const existingGradingCfg = isRecord(targetSubject.grading_config)
        ? { ...targetSubject.grading_config }
        : {};
      const existingCatWeights = isRecord(existingGradingCfg.category_weights)
        ? { ...existingGradingCfg.category_weights }
        : {};

      const isFableCourse =
        mapping.course_fullname.toLowerCase().includes('fable') ||
        mapping.course_shortname.toLowerCase().includes('cw400');

      const syncedCategoryWeights = isFableCourse
        ? {
            ...existingCatWeights,
            essay_composition: { weight: 75, drop_lowest: 0, enabled: true },
            quiz: { weight: 25, drop_lowest: 0, enabled: true },
          }
        : {
            ...existingCatWeights,
            quiz: { weight: 100, drop_lowest: 0, enabled: true },
          };

      const updatedGradingConfig = {
        ...existingGradingCfg,
        course_code: mapping.course_shortname,
        weighting_mode: 'category_weighted',
        category_weights: syncedCategoryWeights,
        moodle_grade_report: moodleGradeReport,
        portal_integration: integrationSnapshot,
      };

      await supabase
        .from('subjects')
        .update({
          course_code: mapping.course_shortname,
          link: resolvedLiveClassroomLink,
          weighting_mode: 'category_weighted',
          recurring_config: JSON.parse(JSON.stringify(updatedRecurringConfig)) as Json,
          grading_config: JSON.parse(JSON.stringify(updatedGradingConfig)) as Json,
        })
        .eq('id', targetSubject.id);

      // 5. Upsert ALL Course Assessments into school.assignments so the Gradebook displays every item
      let upsertedCount = 0;
      for (const item of reportItems) {
        const hasGrade = item.grade_raw !== null;

        const cleanTitle = item.item_name
          .replace(/--DUE[\s\S]*$/i, '')
          .replace(/^LC 4th Edition\s+/i, '')
          .trim();

        const isFinalDraft =
          item.category_name.toLowerCase().includes('final draft') ||
          item.item_module === 'assign';
        const categorySlug = isFinalDraft ? 'essay_composition' : 'quiz';

        const pct =
          hasGrade && item.grade_max > 0 && item.grade_raw !== null
            ? Number(((item.grade_raw / item.grade_max) * 100).toFixed(2))
            : null;
        const letter = pct !== null ? percentageToLetterGrade(pct) : null;

        // Check if assignment already exists for this subject by moodle_cmid or title
        const existingMatch = existingAssignments.find((ea) => {
          if (ea.subject_id !== targetSubject.id) return false;
          if (isRecord(ea.state_standards) && isRecord(ea.state_standards.moodle_meta)) {
            if (ea.state_standards.moodle_meta.moodle_cmid === item.cmid) {
              return true;
            }
          }
          return ea.title.toLowerCase() === cleanTitle.toLowerCase();
        });

        const existingRawMeta =
          existingMatch &&
          isRecord(existingMatch.state_standards) &&
          isRecord(existingMatch.state_standards.moodle_meta)
            ? existingMatch.state_standards.moodle_meta
            : null;
        const isManualOverride =
          existingRawMeta !== null && existingRawMeta.manual_override === true;
        const isSubmittedInApi = Boolean(item.submitted_at);
        const wasAlreadyCompletedOrSubmitted = Boolean(
          existingMatch &&
            (existingMatch.status === 'completed' ||
              existingMatch.workflow_status === 'completed' ||
              existingMatch.workflow_status === 'submitted')
        );

        const moodleMeta: MoodleAssignmentMetadata = {
          moodle_cmid: item.cmid ?? undefined,
          moodle_course_id: mapping.moodle_course_id,
          moodle_category: item.category_name,
          weight_formatted: item.weight_formatted,
          contribution_formatted: item.contribution_formatted,
          range_formatted: item.range_formatted,
          is_ungraded_bucket: item.is_ungraded_bucket,
          week_number: item.week_number,
          official_portal_open_date: item.open_date ?? null,
          official_portal_due_date: item.due_date,
          api_grade_raw: hasGrade ? item.grade_raw : null,
          api_grade_max: item.grade_max || 100,
          api_percentage_score: pct,
          api_letter_grade: letter,
          api_feedback: item.feedback,
          api_submitted_at:
            item.submitted_at ??
            (typeof existingRawMeta?.api_submitted_at === 'string'
              ? existingRawMeta.api_submitted_at
              : null),
          manual_override: isManualOverride,
          manual_override_at:
            isManualOverride && typeof existingRawMeta?.manual_override_at === 'string'
              ? existingRawMeta.manual_override_at
              : isManualOverride
              ? nowIso
              : null,
        };

        const matchedWeekObj = apiWeeks.find((w) => w.week_number === item.week_number);
        const weekRange = matchedWeekObj
          ? parseSectionDateRange(matchedWeekObj.section_title)
          : null;
        let resolvedDueDate = item.due_date || weekRange?.fridayCloseDate || '2026-10-16';
        if (weekRange && item.due_date) {
          const monMs = Date.parse(`${weekRange.mondayStartDate}T00:00:00Z`);
          const dueMs = Date.parse(`${item.due_date}T00:00:00Z`);
          const daysAfterMon = Math.round((dueMs - monMs) / (1000 * 60 * 60 * 24));
          // If Moodle has a blanket quarter-end close date (> 10 days after week start),
          // preserve an already-scheduled due_date or place on the week's completion Thursday (+10 days for Tue-start courses)
          if (daysAfterMon > 10) {
            if (existingMatch?.due_date && existingMatch.due_date !== item.due_date) {
              resolvedDueDate = existingMatch.due_date;
            } else {
              const targetDate = new Date(monMs);
              const offsetDays =
                autoPopulateCfg.week_start_day && autoPopulateCfg.week_start_day !== 'monday'
                  ? 10
                  : 3;
              targetDate.setUTCDate(targetDate.getUTCDate() + offsetDays);
              const ty = targetDate.getUTCFullYear();
              const tm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
              const td = String(targetDate.getUTCDate()).padStart(2, '0');
              resolvedDueDate = `${ty}-${tm}-${td}`;
            }
          }
        }
        const dueDate = resolvedDueDate;
        const openDate = item.open_date || weekRange?.mondayStartDate || dueDate;

        const dateRangeSummary =
          item.open_date && item.due_date
            ? ` • Opens ${item.open_date} • Closes ${item.due_date}`
            : item.due_date
            ? ` • Due ${item.due_date}`
            : '';

        const payload = {
          subject_id: targetSubject.id,
          title: cleanTitle,
          description: `${mapping.course_fullname} • ${
            item.week_number ? `Week ${item.week_number}` : item.category_name
          }${dateRangeSummary}${item.is_ungraded_bucket ? ' (Ungraded / 0% Weight)' : ''}`,
          instructions: matchedWeekObj?.raw_summary || null,
          due_date: dueDate,
          assigned_date: openDate,
          category: categorySlug,
          grading_mode:
            isManualOverride && existingMatch?.grading_mode
              ? existingMatch.grading_mode
              : ('points' as const),
          points_possible:
            isManualOverride && typeof existingMatch?.points_possible === 'number'
              ? existingMatch.points_possible
              : item.grade_max || 100,
          points_earned: isManualOverride
            ? existingMatch?.points_earned ?? null
            : hasGrade
            ? item.grade_raw
            : null,
          percentage_score: isManualOverride
            ? existingMatch?.percentage_score ?? null
            : pct,
          letter_grade: isManualOverride
            ? existingMatch?.letter_grade ?? null
            : letter,
          total_problems: isManualOverride
            ? existingMatch?.total_problems ?? null
            : null,
          missed_problems: isManualOverride
            ? existingMatch?.missed_problems ?? null
            : null,
          status: isManualOverride
            ? existingMatch?.status || ('completed' as const)
            : hasGrade || isSubmittedInApi || wasAlreadyCompletedOrSubmitted
            ? ('completed' as const)
            : ('pending' as const),
          workflow_status: isManualOverride
            ? existingMatch?.workflow_status || ('completed' as const)
            : hasGrade
            ? ('completed' as const)
            : isSubmittedInApi
            ? ('submitted' as const)
            : wasAlreadyCompletedOrSubmitted
            ? (existingMatch?.workflow_status || ('completed' as const))
            : ('not_started' as const),
          completed_at:
            hasGrade || isSubmittedInApi || wasAlreadyCompletedOrSubmitted
              ? item.submitted_at || existingMatch?.completed_at || nowIso
              : null,
          is_graded: true,
          source_type: 'syllabus_staged' as const,
          syllabus_day_number: item.week_number,
          term_name: 'Semester 1 (Fall)',
          academic_year: '2026-2027',
          teacher_comments: isManualOverride
            ? existingMatch?.teacher_comments ?? item.feedback
            : item.feedback,
          state_standards: {
            moodle_meta: JSON.parse(JSON.stringify(moodleMeta)),
          } as unknown as Json,
          updated_at: nowIso,
        };

        if (existingMatch) {
          await supabase.from('assignments').update(payload).eq('id', existingMatch.id);
          upsertedCount++;
        } else {
          const { data: inserted } = await supabase
            .from('assignments')
            .insert({
              ...payload,
              priority: 'medium',
            })
            .select('*')
            .single();
          if (inserted) {
            existingAssignments.push(inserted as unknown as GradebookAssignment);
            upsertedCount++;
          }
        }
      }

      syncedCoursesSummary.push({
        moodle_course_id: mapping.moodle_course_id,
        official_course_name: mapping.course_fullname,
        subject_id: targetSubject.id,
        subject_name: targetSubject.name,
        weeks_count: apiWeeks.length,
        graded_items_count: reportItems.filter((i) => i.grade_raw !== null).length,
        course_total_percentage: courseTotalPercentage,
        assignments_upserted: upsertedCount,
      });
    }

    // Also ensure Math's course_syllabus or existing uploaded syllabi have source_type: 'manual_upload'
    for (const s of subjects) {
      const isMappedToApi = activeMappings.some(
        (m) => !m.ignored && m.subject_id === s.id
      );
      if (isMappedToApi) continue;

      const rec = parseRecurringConfig(s.recurring_config, s.name);
      if (rec.course_syllabus && !rec.course_syllabus.source_type) {
        const nextRec: SubjectRecurringConfig = {
          ...rec,
          course_syllabus: {
            ...rec.course_syllabus,
            source_type: 'manual_upload',
            uploaded_file_name:
              rec.course_syllabus.uploaded_file_name ||
              `${rec.course_syllabus.course_title}.pdf`,
          },
        };
        await supabase
          .from('subjects')
          .update({
            recurring_config: JSON.parse(JSON.stringify(nextRec)) as Json,
          })
          .eq('id', s.id);
      }
    }

    return NextResponse.json({
      ok: true,
      moodle_user_id: moodleUserId,
      student_fullname: studentFullname,
      synced_at: nowIso,
      integration: integrationSnapshot,
      synced_courses: syncedCoursesSummary,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to sync with Memoria Academy portal',
      },
      { status: 500 }
    );
  }
}
