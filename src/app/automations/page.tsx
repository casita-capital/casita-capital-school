'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Repeat,
  Calculator,
  Sparkles,
  Upload,
  FileSpreadsheet,
  Save,
  Edit3,
  Plus,
  CheckCircle2,
  BookOpen,
  Calendar as CalendarIcon,
  Wand2,
  Menu as MenuIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import { FormattedParentNote } from 'src/components/base/formatted-parent-note';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  MathSyllabusDay,
  CourseSyllabusData,
  SubjectRecurringConfig,
  createDefaultMathConfig,
  generateSubjectWeekNotesStructured,
  parseRecurringConfig,
  resolveSubjectCountersForWeek,
} from 'src/utils/recurring-planner';
import type {
  ExtractedSyllabusDayItem,
  ParsedSyllabusReviewPayload,
} from 'src/app/api/automations/parse-syllabus/route';

interface Subject {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  link?: string | null;
  recurring_config?: Json | null;
}

function AutomationsContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [syllabusDays, setSyllabusDays] = useState<MathSyllabusDay[]>([]);
  const [activeTab, setActiveTab] = useState<'automations' | 'syllabus'>('automations');
  const [activeSyllabusSubTab, setActiveSyllabusSubTab] = useState<string>('math');

  // 3-Line Row Menu State
  const [automationMenuAnchorEl, setAutomationMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuAutomationSubject, setMenuAutomationSubject] = useState<Subject | null>(null);

  // Recurring Config Modal State
  const [recurringSubject, setRecurringSubject] = useState<Subject | null>(null);
  const [recurringDraft, setRecurringDraft] = useState<SubjectRecurringConfig | null>(null);
  const [activeRecurringDay, setActiveRecurringDay] = useState<DayKey>('monday');
  const [previewWeekDate, setPreviewWeekDate] = useState<string>('2026-10-19');
  const [savingRecurring, setSavingRecurring] = useState(false);

  // Syllabus Filter & Edit State
  const [syllabusSemesterFilter, setSyllabusSemesterFilter] = useState<'all' | 1 | 2>('all');
  const [editingSyllabusDay, setEditingSyllabusDay] = useState<MathSyllabusDay | null>(null);
  const [isNewSyllabusDay, setIsNewSyllabusDay] = useState(false);
  const [savingSyllabusDay, setSavingSyllabusDay] = useState(false);

  // Gemini Flash Syllabus Upload & AI Builder Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedUploadSubjectId, setSelectedUploadSubjectId] = useState<string>('auto');
  const [newSubjectNameForUpload, setNewSubjectNameForUpload] = useState<string>('');
  const [newSubjectColorForUpload, setNewSubjectColorForUpload] = useState<string>('#0C74E4');
  const [semesterOffsetMode, setSemesterOffsetMode] = useState<'auto' | 'fall_1_32' | 'spring_33_64'>('auto');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [analyzingWithGemini, setAnalyzingWithGemini] = useState(false);
  const [aiReview, setAiReview] = useState<ParsedSyllabusReviewPayload | null>(null);
  const [importSyllabusRows, setImportSyllabusRows] = useState<boolean>(true);
  const [applyingAiAutomation, setApplyingAiAutomation] = useState(false);

  async function loadData() {
    try {
      const { data: subData } = await supabase
        .from('subjects')
        .select('*')
        .order('sort_order', { ascending: true });

      if (subData) {
        setSubjects(subData as Subject[]);
      }

      const { data: sylData } = await supabase
        .from('math_syllabus')
        .select('*')
        .order('day_number', { ascending: true });

      if (sylData) {
        setSyllabusDays(sylData as MathSyllabusDay[]);
      }
    } catch {
      toast.error('Failed to load automations and syllabus data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Support deep-linking from /subjects-habits or /calendar/planner via ?tab=... or ?subject=...
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'syllabus' || tabParam === 'automations') {
      setActiveTab(tabParam);
    } else if (tabParam === 'upload') {
      setUploadModalOpen(true);
    }
    const subjectIdParam = searchParams.get('subject');
    if (subjectIdParam && subjects.length > 0 && !recurringSubject) {
      const found = subjects.find((s) => s.id === subjectIdParam);
      if (found) {
        handleOpenRecurringModal(found);
      }
    }
  }, [searchParams, subjects]);

  const syllabusMap = useMemo(() => {
    const map = new Map<number, MathSyllabusDay>();
    for (const item of syllabusDays) {
      map.set(item.day_number, item);
    }
    return map;
  }, [syllabusDays]);

  const filteredSyllabusDays = useMemo(() => {
    if (syllabusSemesterFilter === 'all') return syllabusDays;
    return syllabusDays.filter((d) => d.semester === syllabusSemesterFilter);
  }, [syllabusDays, syllabusSemesterFilter]);

  // ---------------------------------------------------------------------------
  // RECURRING CONFIG HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenRecurringModal = (sub: Subject) => {
    const parsed = parseRecurringConfig(sub.recurring_config, sub.name);
    setRecurringSubject(sub);
    setRecurringDraft(parsed);
    const firstActive = DAY_KEYS.find((dk) => parsed.days[dk].enabled) || 'monday';
    setActiveRecurringDay(firstActive);
  };

  const handleToggleSubjectAutomationQuick = async (sub: Subject, nextEnabled: boolean) => {
    const parsed = parseRecurringConfig(sub.recurring_config, sub.name);
    const updated: SubjectRecurringConfig = { ...parsed, enabled: nextEnabled };
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ recurring_config: updated as unknown as Json })
        .eq('id', sub.id);

      if (error) {
        toast.error(`Failed to update ${sub.name}: ${error.message}`);
        return;
      }

      setSubjects((prev) =>
        prev.map((s) =>
          s.id === sub.id ? { ...s, recurring_config: updated as unknown as Json } : s
        )
      );
      toast.success(
        `${sub.name} weekly automation ${nextEnabled ? 'enabled' : 'disabled'}`
      );
    } catch {
      toast.error('Failed to toggle subject automation');
    }
  };

  const handleSaveRecurringConfig = async () => {
    if (!recurringSubject || !recurringDraft) return;
    setSavingRecurring(true);
    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          recurring_config: recurringDraft as unknown as Json,
        })
        .eq('id', recurringSubject.id);

      if (error) {
        toast.error(`Failed to save recurring rules: ${error.message}`);
      } else {
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === recurringSubject.id
              ? { ...s, recurring_config: recurringDraft as unknown as Json }
              : s
          )
        );
        toast.success(`Saved recurring automation rules for ${recurringSubject.name}!`);
        setRecurringSubject(null);
      }
    } catch {
      toast.error('Failed to save recurring rules');
    } finally {
      setSavingRecurring(false);
    }
  };

  // ---------------------------------------------------------------------------
  // SYLLABUS DAY HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenAddSyllabusDay = () => {
    const maxDay = syllabusDays.reduce((max, d) => Math.max(max, d.day_number), 0);
    const nextDayNum = maxDay + 1;
    setIsNewSyllabusDay(true);
    setEditingSyllabusDay({
      id: '',
      semester: nextDayNum > 32 ? 2 : 1,
      day_number: nextDayNum,
      workbook: '',
      textbook: '',
      topic: '',
      materials: '',
      fast_facts: '',
      notes: '',
    });
  };

  const handleSaveSyllabusDay = async () => {
    if (!editingSyllabusDay) return;
    setSavingSyllabusDay(true);
    try {
      if (isNewSyllabusDay) {
        const { data, error } = await supabase
          .from('math_syllabus')
          .upsert(
            {
              day_number: editingSyllabusDay.day_number,
              semester: editingSyllabusDay.semester,
              workbook: editingSyllabusDay.workbook,
              textbook: editingSyllabusDay.textbook,
              topic: editingSyllabusDay.topic,
              materials: editingSyllabusDay.materials,
              fast_facts: editingSyllabusDay.fast_facts,
              notes: editingSyllabusDay.notes,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'day_number' }
          )
          .select('*')
          .single();

        if (error) {
          toast.error(`Failed to add syllabus day: ${error.message}`);
        } else if (data) {
          const added = data as MathSyllabusDay;
          setSyllabusDays((prev) =>
            [...prev.filter((d) => d.day_number !== added.day_number), added].sort(
              (a, b) => a.day_number - b.day_number
            )
          );
          toast.success(`Saved Day ${added.day_number} to syllabus!`);
          setEditingSyllabusDay(null);
          setIsNewSyllabusDay(false);
        }
      } else {
        const { error } = await supabase
          .from('math_syllabus')
          .update({
            semester: editingSyllabusDay.semester,
            workbook: editingSyllabusDay.workbook,
            textbook: editingSyllabusDay.textbook,
            topic: editingSyllabusDay.topic,
            materials: editingSyllabusDay.materials,
            fast_facts: editingSyllabusDay.fast_facts,
            notes: editingSyllabusDay.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSyllabusDay.id);

        if (error) {
          toast.error(`Failed to update Day ${editingSyllabusDay.day_number}: ${error.message}`);
        } else {
          setSyllabusDays((prev) =>
            prev.map((d) => (d.id === editingSyllabusDay.id ? editingSyllabusDay : d))
          );
          toast.success(`Updated Math Syllabus Day ${editingSyllabusDay.day_number}!`);
          setEditingSyllabusDay(null);
        }
      }
    } catch {
      toast.error('Failed to save syllabus day');
    } finally {
      setSavingSyllabusDay(false);
    }
  };

  // ---------------------------------------------------------------------------
  // GEMINI FLASH SYLLABUS UPLOAD & REVIEW HANDLERS
  // ---------------------------------------------------------------------------
  const handleAnalyzeSyllabusFile = async (fileToAnalyze: File) => {
    setUploadingFile(fileToAnalyze);
    setAnalyzingWithGemini(true);
    setAiReview(null);

    try {
      const formData = new FormData();
      formData.append('file', fileToAnalyze);

      const targetSubject = subjects.find((s) => s.id === selectedUploadSubjectId);
      if (targetSubject) {
        formData.append('subjectName', targetSubject.name);
      } else if (selectedUploadSubjectId === 'new' && newSubjectNameForUpload.trim()) {
        formData.append('subjectName', newSubjectNameForUpload.trim());
      }

      const res = await fetch('/api/automations/parse-syllabus', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as ParsedSyllabusReviewPayload & { error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error || 'Failed to analyze syllabus with Gemini Flash');
        return;
      }

      // Apply optional semester day-number adjustment if requested by user
      let adjustedDays: ExtractedSyllabusDayItem[] = data.syllabus_days || [];
      if (semesterOffsetMode === 'spring_33_64' && adjustedDays.length > 0) {
        const minDay = Math.min(...adjustedDays.map((d) => d.day_number));
        if (minDay <= 32) {
          adjustedDays = adjustedDays.map((d) => ({
            ...d,
            semester: 2,
            day_number: d.day_number <= 32 ? d.day_number + 32 : d.day_number,
          }));
        }
      } else if (semesterOffsetMode === 'fall_1_32' && adjustedDays.length > 0) {
        adjustedDays = adjustedDays.map((d) => ({
          ...d,
          semester: 1,
        }));
      }

      const finalReview: ParsedSyllabusReviewPayload = {
        ...data,
        syllabus_days: adjustedDays,
      };
      setAiReview(finalReview);

      // Auto-match existing subject if 'auto' was selected
      if (selectedUploadSubjectId === 'auto' && data.detected_subject_name) {
        const detectedLower = data.detected_subject_name.toLowerCase();
        const matchedSub = subjects.find(
          (s) =>
            s.name.toLowerCase() === detectedLower ||
            s.name.toLowerCase().includes(detectedLower) ||
            detectedLower.includes(s.name.toLowerCase())
        );
        if (matchedSub) {
          setSelectedUploadSubjectId(matchedSub.id);
        }
      }

      toast.success(`Syllabus reviewed with ${data.model_used}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze file';
      toast.error(msg);
    } finally {
      setAnalyzingWithGemini(false);
    }
  };

  const handleApplyAiAutomation = async () => {
    if (!aiReview) return;
    setApplyingAiAutomation(true);

    try {
      let targetSubject: Subject | null = null;

      const buildRecurringWithSyllabus = (subName: string): SubjectRecurringConfig => {
        const courseSyllabusPayload: CourseSyllabusData = {
          course_title: aiReview.course_title || `${subName} Syllabus`,
          teacher_name: aiReview.teacher_name || '',
          summary: aiReview.summary || '',
          uploaded_at: new Date().toISOString(),
          days: aiReview.syllabus_days.map((d) => ({
            id: `syl-day-${d.day_number}`,
            day_number: d.day_number,
            semester: d.semester,
            workbook: d.workbook,
            textbook: d.textbook,
            topic: d.topic,
            materials: d.materials,
            fast_facts: d.fast_facts,
            notes: d.notes,
          })),
        };
        return {
          ...aiReview.recurring_config,
          course_syllabus: courseSyllabusPayload,
        };
      };

      if (selectedUploadSubjectId === 'new') {
        const nameToCreate =
          newSubjectNameForUpload.trim() || aiReview.detected_subject_name || 'New Subject';
        const configToSave = buildRecurringWithSyllabus(nameToCreate);
        const { data: createdSub, error: createErr } = await supabase
          .from('subjects')
          .insert({
            name: nameToCreate,
            sort_order: subjects.length + 1,
            color: newSubjectColorForUpload,
            recurring_config: configToSave as unknown as Json,
          })
          .select('*')
          .single();

        if (createErr || !createdSub) {
          toast.error(`Failed to create subject: ${createErr?.message || 'Unknown error'}`);
          return;
        }
        targetSubject = createdSub as Subject;
        setSubjects((prev) => [...prev, targetSubject!]);
      } else {
        const existing =
          subjects.find((s) => s.id === selectedUploadSubjectId) ||
          subjects.find(
            (s) => s.name.toLowerCase() === aiReview.detected_subject_name.toLowerCase()
          );

        if (!existing) {
          toast.error('Please select a target subject or choose "Create New Subject".');
          return;
        }

        const configToSave = buildRecurringWithSyllabus(existing.name);
        const { error: updateErr } = await supabase
          .from('subjects')
          .update({
            recurring_config: configToSave as unknown as Json,
          })
          .eq('id', existing.id);

        if (updateErr) {
          toast.error(`Failed to update automation for ${existing.name}: ${updateErr.message}`);
          return;
        }

        targetSubject = {
          ...existing,
          recurring_config: configToSave as unknown as Json,
        };
        setSubjects((prev) =>
          prev.map((s) => (s.id === targetSubject!.id ? targetSubject! : s))
        );
      }

      // If syllabus rows are included and checked for Math syllabus mode, upsert them into school.math_syllabus
      const isMathSubject =
        aiReview.recurring_config.mode === 'math_syllabus' ||
        targetSubject.name.toLowerCase().includes('math');

      if (importSyllabusRows && aiReview.syllabus_days.length > 0 && isMathSubject) {
        const rowsToUpsert = aiReview.syllabus_days.map((d) => ({
          day_number: d.day_number,
          semester: d.semester,
          workbook: d.workbook,
          textbook: d.textbook,
          topic: d.topic,
          materials: d.materials,
          fast_facts: d.fast_facts,
          notes: d.notes,
          updated_at: new Date().toISOString(),
        }));

        const { error: sylErr } = await supabase
          .from('math_syllabus')
          .upsert(rowsToUpsert, { onConflict: 'day_number' });

        if (sylErr) {
          toast.error(`Saved subject rules, but syllabus table update failed: ${sylErr.message}`);
        } else {
          const { data: refreshedSyl } = await supabase
            .from('math_syllabus')
            .select('*')
            .order('day_number', { ascending: true });
          if (refreshedSyl) {
            setSyllabusDays(refreshedSyl as MathSyllabusDay[]);
          }
        }
      }

      toast.success(`Applied recurring automation & syllabus to ${targetSubject.name}!`);
      setUploadModalOpen(false);
      setActiveTab('syllabus');
      setActiveSyllabusSubTab(isMathSubject ? 'math' : targetSubject.id);
    } catch {
      toast.error('Failed to apply automation');
    } finally {
      setApplyingAiAutomation(false);
    }
  };

  const livePreviewCounters = useMemo(() => {
    if (!recurringDraft) return null;
    return resolveSubjectCountersForWeek(recurringDraft, previewWeekDate, undefined);
  }, [recurringDraft, previewWeekDate]);

  // Live preview of the recurring draft for the selected preview week
  const livePreviewNotes = useMemo(() => {
    if (!recurringDraft || !livePreviewCounters) return null;
    return generateSubjectWeekNotesStructured(
      recurringDraft,
      livePreviewCounters,
      syllabusMap
    );
  }, [recurringDraft, livePreviewCounters, syllabusMap]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Unified Page Header Bar */}
      <Card
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                fontSize: { xs: '1.35rem', sm: '1.6rem' },
                lineHeight: 1.15,
              }}
            >
              Automations &amp; Course Syllabi
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              Toggle recurring weekday templates, manage the 64-day Math syllabus, or import a new syllabus with AI.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<BookOpen size={15} />}
              onClick={() => router.push('/subjects-habits')}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 2,
                px: 1.75,
                py: 0.75,
                borderColor: 'divider',
                color: 'text.primary',
              }}
            >
              Subjects &amp; Habits
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<Wand2 size={15} />}
              onClick={() => setUploadModalOpen(true)}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 2,
                px: 2,
                py: 0.75,
                boxShadow: 'none',
              }}
            >
              Upload Syllabus (AI)
            </Button>
          </Stack>
        </Stack>
      </Card>

      <Card
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          mb: 4,
        }}
      >
        {/* Top Page Sub-Navigation Bar */}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 3, pt: 1.5 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {(
              [
                {
                  value: 'automations',
                  label: 'Subject Automations',
                  icon: <Repeat size={15} />,
                },
                {
                  value: 'syllabus',
                  label: 'Syllabi',
                  icon: <FileSpreadsheet size={15} />,
                },
              ] as const
            ).map((tab) => {
              const isSelected = activeTab === tab.value;
              return (
                <Button
                  key={tab.value}
                  startIcon={tab.icon}
                  onClick={() => setActiveTab(tab.value)}
                  sx={{
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2,
                    py: 1,
                    borderRadius: '6px 6px 0 0',
                    borderBottom: '2px solid',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    color: isSelected ? 'primary.main' : 'text.secondary',
                    bgcolor: 'transparent',
                  }}
                >
                  {tab.label}
                </Button>
              );
            })}
          </Stack>
        </Box>

        <CardContent sx={{ p: 3 }}>
          {/* =============================================================== */}
          {/* TAB 1: SUBJECT AUTOMATIONS & WEEKLY DEFAULTS                    */}
          {/* =============================================================== */}
          {activeTab === 'automations' && (
            <Box>
              <Stack spacing={1.25}>
                {subjects.map((sub) => {
                  const recConfig = parseRecurringConfig(sub.recurring_config, sub.name);
                  const activeDayKeys =
                    recConfig.mode === 'math_syllabus'
                      ? DAY_KEYS.filter((dk) => {
                          const mc = recConfig.math_config || createDefaultMathConfig();
                          return (
                            (mc.fast_facts_enabled && mc.fast_facts_days.includes(dk)) ||
                            (mc.attend_class_enabled && mc.attend_class_days.includes(dk)) ||
                            (mc.homework_enabled && (dk === 'monday' || dk === 'wednesday')) ||
                            recConfig.days[dk].enabled
                          );
                        })
                      : DAY_KEYS.filter((dk) => recConfig.days[dk].enabled);

                  return (
                    <Paper
                      key={sub.id}
                      variant="outlined"
                      sx={{
                        px: 2.25,
                        py: 1.5,
                        borderRadius: 2,
                        borderLeft: `4px solid ${sub.color || '#0C74E4'}`,
                        transition: 'border-color 0.15s ease, background-color 0.15s ease',
                        '&:hover': {
                          borderColor: alpha(theme.palette.primary.main, 0.45),
                          bgcolor: alpha(theme.palette.primary.main, 0.015),
                        },
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        spacing={1.5}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" flexGrow={1}>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ minWidth: 150 }}>
                            {sub.name}
                          </Typography>

                          <Chip
                            icon={
                              recConfig.mode === 'math_syllabus' ? (
                                <Calculator size={12} />
                              ) : (
                                <Repeat size={12} />
                              )
                            }
                            label={
                              recConfig.mode === 'math_syllabus'
                                ? '64-Day Syllabus'
                                : 'Weekly Template'
                            }
                            size="small"
                            color={recConfig.mode === 'math_syllabus' ? 'secondary' : 'primary'}
                            variant="outlined"
                            onClick={() => handleOpenRecurringModal(sub)}
                            sx={{ fontWeight: 600, fontSize: '0.7rem', height: 24, cursor: 'pointer' }}
                          />

                          {/* Compact Active Weekday Pills */}
                          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                            {DAY_KEYS.map((dk) => {
                              const isActive = activeDayKeys.includes(dk);
                              return (
                                <Chip
                                  key={dk}
                                  label={DAY_LABELS[dk].slice(0, 3)}
                                  size="small"
                                  color={isActive && recConfig.enabled ? 'primary' : 'default'}
                                  variant={isActive && recConfig.enabled ? 'filled' : 'outlined'}
                                  sx={{
                                    height: 21,
                                    fontSize: '0.68rem',
                                    fontWeight: isActive ? 700 : 500,
                                    opacity: isActive ? 1 : 0.4,
                                  }}
                                />
                              );
                            })}
                          </Stack>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                          <FormControlLabel
                            sx={{ mr: 0.5 }}
                            control={
                              <Switch
                                size="small"
                                checked={recConfig.enabled}
                                onChange={(e) =>
                                  handleToggleSubjectAutomationQuick(sub, e.target.checked)
                                }
                                color="success"
                              />
                            }
                            label={
                              <Typography variant="caption" fontWeight={700} color={recConfig.enabled ? 'success.main' : 'text.secondary'}>
                                {recConfig.enabled ? 'On' : 'Off'}
                              </Typography>
                            }
                          />

                          <IconButton
                            size="small"
                            aria-label="Automation options"
                            onClick={(e) => {
                              setAutomationMenuAnchorEl(e.currentTarget);
                              setMenuAutomationSubject(sub);
                            }}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1.5,
                              p: 0.65,
                            }}
                          >
                            <MenuIcon size={16} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>

              {/* Subject Automation 3-Line Menu */}
              <Menu
                anchorEl={automationMenuAnchorEl}
                open={Boolean(automationMenuAnchorEl && menuAutomationSubject)}
                onClose={() => {
                  setAutomationMenuAnchorEl(null);
                  setMenuAutomationSubject(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                  paper: {
                    elevation: 4,
                    sx: {
                      mt: 0.5,
                      minWidth: 235,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 0.5,
                    },
                  },
                }}
              >
                {menuAutomationSubject && (
                  <Box sx={{ px: 1.5, py: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {menuAutomationSubject.name}
                    </Typography>
                  </Box>
                )}
                <MenuItem
                  onClick={() => {
                    const target = menuAutomationSubject;
                    setAutomationMenuAnchorEl(null);
                    setMenuAutomationSubject(null);
                    if (target) handleOpenRecurringModal(target);
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 600 }}
                >
                  <Edit3 size={15} color={theme.palette.primary.main} />
                  Configure Automation Rules…
                </MenuItem>
                {menuAutomationSubject &&
                  (() => {
                    const cfg = parseRecurringConfig(
                      menuAutomationSubject.recurring_config,
                      menuAutomationSubject.name
                    );
                    const isMath = cfg.mode === 'math_syllabus';
                    const hasCourseSyllabus = Boolean(cfg.course_syllabus);
                    if (!isMath && !hasCourseSyllabus) return null;
                    return (
                      <MenuItem
                        onClick={() => {
                          const targetId = isMath ? 'math' : menuAutomationSubject.id;
                          setAutomationMenuAnchorEl(null);
                          setMenuAutomationSubject(null);
                          setActiveTab('syllabus');
                          setActiveSyllabusSubTab(targetId);
                        }}
                        sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 500 }}
                      >
                        <FileSpreadsheet size={15} />
                        View Course Syllabus
                      </MenuItem>
                    );
                  })()}
                <MenuItem
                  onClick={() => {
                    const target = menuAutomationSubject;
                    setAutomationMenuAnchorEl(null);
                    setMenuAutomationSubject(null);
                    if (target) {
                      setSelectedUploadSubjectId(target.id);
                    }
                    setUploadModalOpen(true);
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 500 }}
                >
                  <Wand2 size={15} />
                  Upload Syllabus with AI…
                </MenuItem>
              </Menu>
            </Box>
          )}

          {/* =============================================================== */}
          {/* TAB 2: SYLLABI (WITH SUB-TABS PER UPLOADED SYLLABUS)            */}
          {/* =============================================================== */}
          {activeTab === 'syllabus' && (
            <Box>
              {/* Syllabus Sub-Tabs Bar */}
              <Box
                sx={{
                  mb: 3,
                  p: 1,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant={activeSyllabusSubTab === 'math' ? 'contained' : 'text'}
                    color="primary"
                    startIcon={<Calculator size={15} />}
                    onClick={() => setActiveSyllabusSubTab('math')}
                    sx={{
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 1.5,
                      px: 1.75,
                      py: 0.65,
                      boxShadow: 'none',
                    }}
                  >
                    Math — Dimensions Math 5 ({syllabusDays.length} Days)
                  </Button>

                  {subjects
                    .filter((sub) => {
                      const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
                      return cfg.mode !== 'math_syllabus' && Boolean(cfg.course_syllabus);
                    })
                    .map((sub) => {
                      const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
                      const syl = cfg.course_syllabus;
                      const isSubSelected = activeSyllabusSubTab === sub.id;
                      return (
                        <Button
                          key={sub.id}
                          size="small"
                          variant={isSubSelected ? 'contained' : 'text'}
                          color="primary"
                          startIcon={
                            <Box
                              sx={{
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                bgcolor: isSubSelected ? '#FFFFFF' : sub.color || '#0C74E4',
                              }}
                            />
                          }
                          onClick={() => setActiveSyllabusSubTab(sub.id)}
                          sx={{
                            fontWeight: 700,
                            textTransform: 'none',
                            borderRadius: 1.5,
                            px: 1.75,
                            py: 0.65,
                            boxShadow: 'none',
                          }}
                        >
                          {sub.name}
                          {syl?.days?.length ? ` (${syl.days.length} Days)` : ''}
                        </Button>
                      );
                    })}
                </Stack>

                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<Wand2 size={14} />}
                  onClick={() => setUploadModalOpen(true)}
                  sx={{
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 1.5,
                    bgcolor: 'background.paper',
                  }}
                >
                  + Upload Syllabus (AI)
                </Button>
              </Box>

              {activeSyllabusSubTab === 'math' ? (
                <Box>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    spacing={2}
                    mb={3}
                  >
                    <Box>
                      <Typography variant="h6" fontWeight={800}>
                        Dimensions Math® Level 5 (5A &amp; 5B) Syllabus
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        All {syllabusDays.length} days from Amanda Holiday&apos;s Fall (5A: Days 1–32) and Spring (5B: Days 33–64) syllabus. Click edit on any day to customize workbook pages, materials, or notes.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button
                        size="small"
                        variant={syllabusSemesterFilter === 'all' ? 'contained' : 'outlined'}
                        onClick={() => setSyllabusSemesterFilter('all')}
                        sx={{ fontWeight: 700 }}
                      >
                        All (Days 1–64)
                      </Button>
                      <Button
                        size="small"
                        variant={syllabusSemesterFilter === 1 ? 'contained' : 'outlined'}
                        onClick={() => setSyllabusSemesterFilter(1)}
                        sx={{ fontWeight: 700 }}
                      >
                        Fall 5A (Days 1–32)
                      </Button>
                      <Button
                        size="small"
                        variant={syllabusSemesterFilter === 2 ? 'contained' : 'outlined'}
                        onClick={() => setSyllabusSemesterFilter(2)}
                        sx={{ fontWeight: 700 }}
                      >
                        Spring 5B (Days 33–64)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        startIcon={<Plus size={15} />}
                        onClick={handleOpenAddSyllabusDay}
                        sx={{ fontWeight: 700, textTransform: 'none' }}
                      >
                        Add Day
                      </Button>
                    </Stack>
                  </Stack>

                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 640, borderRadius: 2 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, width: 85 }}>Day</TableCell>
                          <TableCell sx={{ fontWeight: 800, width: 95 }}>Sem</TableCell>
                          <TableCell sx={{ fontWeight: 800, width: 150 }}>Workbook HW</TableCell>
                          <TableCell sx={{ fontWeight: 800, width: 130 }}>Textbook</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Topic</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Class Materials</TableCell>
                          <TableCell sx={{ fontWeight: 800, width: 150 }}>Fast Facts</TableCell>
                          <TableCell sx={{ fontWeight: 800, width: 70 }} align="right">
                            Edit
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredSyllabusDays.map((day) => (
                          <TableRow key={day.id || day.day_number} hover>
                            <TableCell sx={{ fontWeight: 700 }}>Day {day.day_number}</TableCell>
                            <TableCell>
                              <Chip
                                label={day.semester === 1 ? '5A (Fall)' : '5B (Spring)'}
                                size="small"
                                color={day.semester === 1 ? 'primary' : 'secondary'}
                                variant="outlined"
                                sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {day.workbook || '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.78rem' }}>{day.textbook || '—'}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{day.topic}</TableCell>
                            <TableCell sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                              {day.materials || '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.76rem' }}>{day.fast_facts || '—'}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => {
                                  setIsNewSyllabusDay(false);
                                  setEditingSyllabusDay({ ...day });
                                }}
                              >
                                <Edit3 size={16} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : (
                (() => {
                  const selectedSub = subjects.find((s) => s.id === activeSyllabusSubTab);
                  if (!selectedSub) return null;
                  const subCfg = parseRecurringConfig(selectedSub.recurring_config, selectedSub.name);
                  const courseSyl = subCfg.course_syllabus;
                  if (!courseSyl) return null;

                  return (
                    <Box>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        spacing={2}
                        mb={2.5}
                      >
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: selectedSub.color || '#0C74E4',
                              }}
                            />
                            <Typography variant="h6" fontWeight={800}>
                              {courseSyl.course_title || `${selectedSub.name} Syllabus`}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {courseSyl.teacher_name ? `Instructor: ${courseSyl.teacher_name} • ` : ''}
                            {courseSyl.summary || 'Uploaded course syllabus'}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Edit3 size={14} />}
                            onClick={() => handleOpenRecurringModal(selectedSub)}
                            sx={{ fontWeight: 700, textTransform: 'none' }}
                          >
                            Edit Automation Rules
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="secondary"
                            startIcon={<Wand2 size={14} />}
                            onClick={() => {
                              setSelectedUploadSubjectId(selectedSub.id);
                              setUploadModalOpen(true);
                            }}
                            sx={{ fontWeight: 700, textTransform: 'none' }}
                          >
                            Re-Upload Syllabus
                          </Button>
                        </Stack>
                      </Stack>

                      {courseSyl.days.length > 0 ? (
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 640, borderRadius: 2 }}>
                          <Table stickyHeader size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 800, width: 85 }}>Day / Wk</TableCell>
                                <TableCell sx={{ fontWeight: 800, width: 95 }}>Sem</TableCell>
                                <TableCell sx={{ fontWeight: 800, width: 160 }}>Homework / Workbook</TableCell>
                                <TableCell sx={{ fontWeight: 800, width: 140 }}>Reading / Textbook</TableCell>
                                <TableCell sx={{ fontWeight: 800 }}>Topic / Lesson</TableCell>
                                <TableCell sx={{ fontWeight: 800 }}>Materials</TableCell>
                                <TableCell sx={{ fontWeight: 800 }}>Notes</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {courseSyl.days.map((day) => (
                                <TableRow key={day.day_number} hover>
                                  <TableCell sx={{ fontWeight: 700 }}>#{day.day_number}</TableCell>
                                  <TableCell>
                                    <Chip
                                      label={day.semester === 1 ? 'Fall' : 'Spring'}
                                      size="small"
                                      color={day.semester === 1 ? 'primary' : 'secondary'}
                                      variant="outlined"
                                      sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                                    {day.workbook || '—'}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: '0.78rem' }}>{day.textbook || '—'}</TableCell>
                                  <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{day.topic}</TableCell>
                                  <TableCell sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                                    {day.materials || '—'}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: '0.76rem' }}>{day.notes || day.fast_facts || '—'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, bgcolor: 'background.default' }}>
                          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                            Recurring Schedule Extracted from Syllabus
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {courseSyl.summary ||
                              'This syllabus uses a recurring weekly template. Click "Edit Automation Rules" above to view or customize its weekday templates.'}
                          </Typography>
                        </Paper>
                      )}
                    </Box>
                  );
                })()
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ===================================================================== */}
      {/* RECURRING RULES CONFIGURATION MODAL (React 19 safe, 2-Row Top Box)    */}
      {/* ===================================================================== */}
      {recurringSubject && recurringDraft && (
        <Box
          onClick={() => setRecurringSubject(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Paper
            elevation={12}
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: '100%',
              maxWidth: 960,
              maxHeight: '90vh',
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <Box px={3} py={2} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1.5}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: recurringSubject.color || '#0C74E4',
                    }}
                  />
                  <Typography variant="h6" fontWeight={800}>
                    Recurring Weekly Rules — {recurringSubject.name}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip
                    label={recurringDraft.enabled ? 'ENABLED' : 'DISABLED'}
                    size="small"
                    color={recurringDraft.enabled ? 'success' : 'default'}
                    sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={recurringDraft.enabled}
                        onChange={(e) =>
                          setRecurringDraft({ ...recurringDraft, enabled: e.target.checked })
                        }
                        color="success"
                      />
                    }
                    label={
                      <Typography variant="subtitle2" fontWeight={800}>
                        {recurringDraft.enabled ? 'Automation Enabled' : 'Automation Disabled'}
                      </Typography>
                    }
                  />
                </Stack>
              </Stack>
            </Box>

            {/* Modal Body */}
            <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
              <Stack spacing={3}>
                {/* 1. TWO-ROW TOP CONFIGURATION BOX:
                    Row 1: Automation Mode Selection
                    Row 2: The 3 Reference / Counter Selection Boxes */}
                <Paper
                  variant="outlined"
                  sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.default' }}
                >
                  <Stack spacing={2.5}>
                    {/* ROW 1: Automation Mode (and Reference Week in Template Mode so Row 2 has 3 counter boxes) */}
                    <Grid container spacing={2} alignItems="center">
                      <Grid
                        item
                        xs={12}
                        sm={recurringDraft.mode === 'template' ? 7 : 12}
                      >
                        <TextField
                          select
                          SelectProps={{ native: true }}
                          fullWidth
                          size="small"
                          label="Automation Mode"
                          value={recurringDraft.mode}
                          onChange={(e) => {
                            const newMode =
                              e.target.value === 'math_syllabus' ? 'math_syllabus' : 'template';
                            setRecurringDraft({
                              ...recurringDraft,
                              mode: newMode,
                              math_config:
                                newMode === 'math_syllabus'
                                  ? recurringDraft.math_config || createDefaultMathConfig()
                                  : recurringDraft.math_config,
                            });
                          }}
                        >
                          <option value="template">
                            Standard Weekly / Daily Template (Week #, Class #, Lesson #)
                          </option>
                          <option value="math_syllabus">
                            Math Syllabus-Driven Schedule (Days 1–64)
                          </option>
                        </TextField>
                      </Grid>

                      {recurringDraft.mode === 'template' && (
                        <Grid item xs={12} sm={5}>
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Reference Week (Monday)"
                            value={recurringDraft.base_week_date}
                            onChange={(e) =>
                              setRecurringDraft({
                                ...recurringDraft,
                                base_week_date: e.target.value,
                              })
                            }
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      )}
                    </Grid>

                    {/* ROW 2: The 3 Selection / Counter Boxes */}
                    {recurringDraft.mode === 'template' ? (
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Reference Week # ({week})"
                            value={recurringDraft.base_week_num}
                            onChange={(e) =>
                              setRecurringDraft({
                                ...recurringDraft,
                                base_week_num: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            helperText="Iterates +1 each week"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Start Class # ({class_num})"
                            value={recurringDraft.base_class_num}
                            onChange={(e) =>
                              setRecurringDraft({
                                ...recurringDraft,
                                base_class_num: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            helperText="Iterates +1 per class day in week"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Reference Lesson # ({lesson})"
                            value={recurringDraft.base_lesson_num}
                            onChange={(e) =>
                              setRecurringDraft({
                                ...recurringDraft,
                                base_lesson_num: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            helperText="Also provides {prev_lesson}"
                          />
                        </Grid>
                      </Grid>
                    ) : (
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Reference Week (Monday)"
                            value={recurringDraft.base_week_date}
                            onChange={(e) =>
                              setRecurringDraft({
                                ...recurringDraft,
                                base_week_date: e.target.value,
                              })
                            }
                            InputLabelProps={{ shrink: true }}
                            helperText="Anchor week for syllabus days"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Ref Tuesday Syllabus Day #"
                            value={recurringDraft.math_config?.base_tuesday_day ?? 12}
                            onChange={(e) => {
                              const mc = recurringDraft.math_config || createDefaultMathConfig();
                              setRecurringDraft({
                                ...recurringDraft,
                                math_config: {
                                  ...mc,
                                  base_tuesday_day: Math.max(1, parseInt(e.target.value, 10) || 1),
                                },
                              });
                            }}
                            helperText="e.g. Day 12 on week of 10/12"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Ref Thursday Syllabus Day #"
                            value={recurringDraft.math_config?.base_thursday_day ?? 13}
                            onChange={(e) => {
                              const mc = recurringDraft.math_config || createDefaultMathConfig();
                              setRecurringDraft({
                                ...recurringDraft,
                                math_config: {
                                  ...mc,
                                  base_thursday_day: Math.max(1, parseInt(e.target.value, 10) || 1),
                                },
                              });
                            }}
                            helperText="e.g. Day 13 on week of 10/12"
                          />
                        </Grid>
                      </Grid>
                    )}
                  </Stack>
                </Paper>

                {/* 2A. MATH SYLLABUS MODE CONTROLS */}
                {recurringDraft.mode === 'math_syllabus' && (
                  <Stack spacing={2.5}>
                    {(() => {
                      const mc = recurringDraft.math_config || createDefaultMathConfig();
                      const updateMc = (patch: Partial<typeof mc>) =>
                        setRecurringDraft({
                          ...recurringDraft,
                          math_config: { ...mc, ...patch },
                        });

                      const toggleDayInList = (list: DayKey[], day: DayKey): DayKey[] =>
                        list.includes(day) ? list.filter((d) => d !== day) : [...list, day];

                      return (
                        <>
                          {/* Fast Facts Card */}
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              justifyContent="space-between"
                              alignItems={{ xs: 'flex-start', sm: 'center' }}
                              spacing={1.5}
                              mb={2}
                            >
                              <Box>
                                <Typography variant="subtitle1" fontWeight={800}>
                                  1. Daily &ldquo;Fast Facts&rdquo; Label
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Toggle whether to place Fast Facts on specific days of the week and customize the label text.
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip
                                  label={mc.fast_facts_enabled ? 'ON' : 'OFF'}
                                  size="small"
                                  color={mc.fast_facts_enabled ? 'primary' : 'default'}
                                  sx={{ fontWeight: 800, height: 20, fontSize: '0.68rem' }}
                                />
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={mc.fast_facts_enabled}
                                      onChange={(e) =>
                                        updateMc({ fast_facts_enabled: e.target.checked })
                                      }
                                      color="primary"
                                    />
                                  }
                                  label={
                                    <Typography variant="body2" fontWeight={700}>
                                      {mc.fast_facts_enabled ? 'Enabled' : 'Disabled'}
                                    </Typography>
                                  }
                                />
                              </Stack>
                            </Stack>

                            {mc.fast_facts_enabled && (
                              <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={5}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Fast Facts Checkbox Label"
                                    value={mc.fast_facts_label}
                                    onChange={(e) => updateMc({ fast_facts_label: e.target.value })}
                                    helperText="e.g. Fast Facts"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={7}>
                                  <Typography
                                    variant="caption"
                                    fontWeight={700}
                                    display="block"
                                    mb={0.5}
                                  >
                                    Days to include Fast Facts:
                                  </Typography>
                                  <Stack direction="row" spacing={1} flexWrap="wrap">
                                    {DAY_KEYS.map((dk) => {
                                      const active = mc.fast_facts_days.includes(dk);
                                      return (
                                        <Chip
                                          key={dk}
                                          label={DAY_LABELS[dk]}
                                          size="small"
                                          color={active ? 'primary' : 'default'}
                                          variant={active ? 'filled' : 'outlined'}
                                          onClick={() =>
                                            updateMc({
                                              fast_facts_days: toggleDayInList(
                                                mc.fast_facts_days,
                                                dk
                                              ),
                                            })
                                          }
                                          sx={{ fontWeight: 700, cursor: 'pointer' }}
                                        />
                                      );
                                    })}
                                  </Stack>
                                </Grid>
                              </Grid>
                            )}
                          </Paper>

                          {/* Attend Class Card */}
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              justifyContent="space-between"
                              alignItems={{ xs: 'flex-start', sm: 'center' }}
                              spacing={1.5}
                              mb={2}
                            >
                              <Box>
                                <Typography variant="subtitle1" fontWeight={800}>
                                  2. &ldquo;Attend Class - Day #&rdquo; &amp; Class Materials (Tue &amp; Thu)
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Configure the class attendance label and optional syllabus details (Additional Class Materials, Lesson Topic).
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip
                                  label={mc.attend_class_enabled ? 'ON' : 'OFF'}
                                  size="small"
                                  color={mc.attend_class_enabled ? 'primary' : 'default'}
                                  sx={{ fontWeight: 800, height: 20, fontSize: '0.68rem' }}
                                />
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={mc.attend_class_enabled}
                                      onChange={(e) =>
                                        updateMc({ attend_class_enabled: e.target.checked })
                                      }
                                      color="primary"
                                    />
                                  }
                                  label={
                                    <Typography variant="body2" fontWeight={700}>
                                      {mc.attend_class_enabled ? 'Enabled' : 'Disabled'}
                                    </Typography>
                                  }
                                />
                              </Stack>
                            </Stack>

                            {mc.attend_class_enabled && (
                              <Stack spacing={2}>
                                <Grid container spacing={2} alignItems="center">
                                  <Grid item xs={12} sm={6}>
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label="Attend Class Label Template"
                                      value={mc.attend_class_label}
                                      onChange={(e) =>
                                        updateMc({ attend_class_label: e.target.value })
                                      }
                                      helperText="Use {day} for the Syllabus Day # (e.g. Attend Class - Day {day})"
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <Typography
                                      variant="caption"
                                      fontWeight={700}
                                      display="block"
                                      mb={0.5}
                                    >
                                      Math Class Days:
                                    </Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                      {DAY_KEYS.map((dk) => {
                                        const active = mc.attend_class_days.includes(dk);
                                        return (
                                          <Chip
                                            key={dk}
                                            label={DAY_LABELS[dk]}
                                            size="small"
                                            color={active ? 'primary' : 'default'}
                                            variant={active ? 'filled' : 'outlined'}
                                            onClick={() =>
                                              updateMc({
                                                attend_class_days: toggleDayInList(
                                                  mc.attend_class_days,
                                                  dk
                                                ),
                                              })
                                            }
                                            sx={{ fontWeight: 700, cursor: 'pointer' }}
                                          />
                                        );
                                      })}
                                    </Stack>
                                  </Grid>
                                </Grid>

                                <Divider />

                                <Grid container spacing={2} alignItems="center">
                                  <Grid item xs={12} sm={6}>
                                    <FormControlLabel
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={mc.include_materials}
                                          onChange={(e) =>
                                            updateMc({ include_materials: e.target.checked })
                                          }
                                        />
                                      }
                                      label={
                                        <Typography variant="body2" fontWeight={600}>
                                          Include &ldquo;Additional Class Materials to bring&rdquo; from syllabus
                                        </Typography>
                                      }
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <FormControlLabel
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={mc.include_topic}
                                          onChange={(e) =>
                                            updateMc({ include_topic: e.target.checked })
                                          }
                                        />
                                      }
                                      label={
                                        <Typography variant="body2" fontWeight={600}>
                                          Include Lesson Topic bullet on class days (e.g. Topic: Ch. 4 Lesson 1–2)
                                        </Typography>
                                      }
                                    />
                                  </Grid>
                                </Grid>
                              </Stack>
                            )}
                          </Paper>

                          {/* Workbook Homework Card */}
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              justifyContent="space-between"
                              alignItems={{ xs: 'flex-start', sm: 'center' }}
                              spacing={1.5}
                              mb={2}
                            >
                              <Box>
                                <Typography variant="subtitle1" fontWeight={800}>
                                  3. Workbook Homework Pages (Mon &amp; Wed)
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Tuesday&apos;s syllabus workbook homework is assigned on Monday; Thursday&apos;s syllabus workbook homework is assigned on Wednesday.
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip
                                  label={mc.homework_enabled ? 'ON' : 'OFF'}
                                  size="small"
                                  color={mc.homework_enabled ? 'primary' : 'default'}
                                  sx={{ fontWeight: 800, height: 20, fontSize: '0.68rem' }}
                                />
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={mc.homework_enabled}
                                      onChange={(e) =>
                                        updateMc({ homework_enabled: e.target.checked })
                                      }
                                      color="primary"
                                    />
                                  }
                                  label={
                                    <Typography variant="body2" fontWeight={700}>
                                      {mc.homework_enabled ? 'Enabled' : 'Disabled'}
                                    </Typography>
                                  }
                                />
                              </Stack>
                            </Stack>

                            {mc.homework_enabled && (
                              <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Workbook Homework Label"
                                    value={mc.homework_label}
                                    onChange={(e) => updateMc({ homework_label: e.target.value })}
                                    helperText="Use {workbook} for workbook pages"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    select
                                    SelectProps={{ native: true }}
                                    fullWidth
                                    size="small"
                                    label="Monday Homework Source"
                                    value={mc.monday_homework_source}
                                    onChange={(e) =>
                                      updateMc({
                                        monday_homework_source:
                                          e.target.value === 'tuesday_class' ||
                                          e.target.value === 'thursday_class'
                                            ? e.target.value
                                            : 'none',
                                      })
                                    }
                                  >
                                    <option value="tuesday_class">Tuesday&apos;s Math Class Day</option>
                                    <option value="thursday_class">Thursday&apos;s Math Class Day</option>
                                    <option value="none">None (Disabled on Monday)</option>
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    select
                                    SelectProps={{ native: true }}
                                    fullWidth
                                    size="small"
                                    label="Wednesday Homework Source"
                                    value={mc.wednesday_homework_source}
                                    onChange={(e) =>
                                      updateMc({
                                        wednesday_homework_source:
                                          e.target.value === 'tuesday_class' ||
                                          e.target.value === 'thursday_class'
                                            ? e.target.value
                                            : 'none',
                                      })
                                    }
                                  >
                                    <option value="thursday_class">Thursday&apos;s Math Class Day</option>
                                    <option value="tuesday_class">Tuesday&apos;s Math Class Day</option>
                                    <option value="none">None (Disabled on Wednesday)</option>
                                  </TextField>
                                </Grid>
                                <Grid item xs={12}>
                                  <Stack direction="row" spacing={3} flexWrap="wrap">
                                    <FormControlLabel
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={mc.include_textbook}
                                          onChange={(e) =>
                                            updateMc({ include_textbook: e.target.checked })
                                          }
                                        />
                                      }
                                      label={
                                        <Typography variant="body2">
                                          Also show Textbook pages on homework days
                                        </Typography>
                                      }
                                    />
                                    <FormControlLabel
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={mc.include_homework_notes}
                                          onChange={(e) =>
                                            updateMc({ include_homework_notes: e.target.checked })
                                          }
                                        />
                                      }
                                      label={
                                        <Typography variant="body2">
                                          Include special teacher homework notes from syllabus
                                        </Typography>
                                      }
                                    />
                                  </Stack>
                                </Grid>
                              </Grid>
                            )}
                          </Paper>
                        </>
                      );
                    })()}
                  </Stack>
                )}

                {/* 2B. DAY-BY-DAY TEMPLATE EDITOR */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={800} mb={0.5}>
                    {recurringDraft.mode === 'math_syllabus'
                      ? '4. Optional Custom Day Notes (Mon–Fri)'
                      : 'Day-by-Day Recurring Templates & Labels (Mon–Fri)'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    Select each day of the week to turn its recurring template on/off, toggle &ldquo;Attend Class&rdquo;, and edit the assignment lines.
                  </Typography>

                  {/* Day Tabs */}
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                  >
                    {DAY_KEYS.map((dk) => {
                      const dCfg = recurringDraft.days[dk];
                      const isSelected = activeRecurringDay === dk;
                      return (
                        <Button
                          key={dk}
                          onClick={() => setActiveRecurringDay(dk)}
                          sx={{
                            fontWeight: 700,
                            textTransform: 'none',
                            px: 2,
                            py: 1,
                            borderRadius: '6px 6px 0 0',
                            borderBottom: '3px solid',
                            borderColor: isSelected ? 'primary.main' : 'transparent',
                            color: isSelected ? 'primary.main' : 'text.secondary',
                            bgcolor: isSelected ? 'action.hover' : 'transparent',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span>{DAY_LABELS[dk]}</span>
                            <Chip
                              label={dCfg.enabled ? 'ON' : 'OFF'}
                              size="small"
                              color={dCfg.enabled ? 'success' : 'default'}
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }}
                            />
                          </Stack>
                        </Button>
                      );
                    })}
                  </Stack>

                  {(() => {
                    const dayCfg = recurringDraft.days[activeRecurringDay];
                    const updateDay = (patch: Partial<typeof dayCfg>) =>
                      setRecurringDraft({
                        ...recurringDraft,
                        days: {
                          ...recurringDraft.days,
                          [activeRecurringDay]: { ...dayCfg, ...patch },
                        },
                      });

                    return (
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={2}
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          justifyContent="space-between"
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={dayCfg.enabled ? 'ON' : 'OFF'}
                              size="small"
                              color={dayCfg.enabled ? 'primary' : 'default'}
                              sx={{ fontWeight: 800, height: 20, fontSize: '0.68rem' }}
                            />
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={dayCfg.enabled}
                                  onChange={(e) => updateDay({ enabled: e.target.checked })}
                                  color="primary"
                                />
                              }
                              label={
                                <Typography variant="subtitle2" fontWeight={700}>
                                  Enable Recurring Template on {DAY_LABELS[activeRecurringDay]}
                                </Typography>
                              }
                            />
                          </Stack>

                          {recurringDraft.mode === 'template' && (
                            <Stack direction="row" spacing={2} alignItems="center">
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={dayCfg.attend_class}
                                    onChange={(e) =>
                                      updateDay({
                                        enabled: e.target.checked ? true : dayCfg.enabled,
                                        attend_class: e.target.checked,
                                      })
                                    }
                                  />
                                }
                                label={
                                  <Typography variant="body2" fontWeight={600}>
                                    Include &ldquo;Attend Class&rdquo; label
                                  </Typography>
                                }
                              />
                              {dayCfg.attend_class && (
                                <TextField
                                  size="small"
                                  label="Attend Class Label"
                                  value={dayCfg.attend_class_label}
                                  onChange={(e) =>
                                    updateDay({ attend_class_label: e.target.value })
                                  }
                                  sx={{ width: 190 }}
                                />
                              )}
                            </Stack>
                          )}
                        </Stack>

                        {dayCfg.enabled && (
                          <Stack spacing={1.5}>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                color="text.secondary"
                                sx={{ alignSelf: 'center' }}
                              >
                                Insert Token:
                              </Typography>
                              {[
                                { label: '+ {week}', token: '{week}' },
                                { label: '+ {class_num}', token: '{class_num}' },
                                { label: '+ {lesson}', token: '{lesson}' },
                                { label: '+ {prev_lesson}', token: '{prev_lesson}' },
                                { label: '+ Checkbox', token: '\n- [ ] ' },
                                { label: '+ Bullet', token: '\n• ' },
                              ].map((btn) => (
                                <Chip
                                  key={btn.label}
                                  label={btn.label}
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    updateDay({
                                      template: `${dayCfg.template}${btn.token}`.replace(
                                        /^\n/,
                                        ''
                                      ),
                                    })
                                  }
                                  sx={{
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                  }}
                                />
                              ))}
                            </Stack>
                            <TextField
                              fullWidth
                              multiline
                              rows={4}
                              size="small"
                              label={`${DAY_LABELS[activeRecurringDay]} Assignment Lines (First line without bullet/checkbox is bold header)`}
                              placeholder="Week {week}&#10;- [ ] Do 2 pages&#10;- [ ] Study vocabulary"
                              value={dayCfg.template}
                              onChange={(e) => updateDay({ template: e.target.value })}
                            />
                          </Stack>
                        )}
                      </Stack>
                    );
                  })()}
                </Paper>

                {/* 3. LIVE 5-DAY WEEK PREVIEW */}
                {livePreviewNotes && livePreviewCounters && (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.default' }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      spacing={1.5}
                      mb={2}
                    >
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Sparkles size={18} color={theme.palette.primary.main} />
                          <Typography variant="subtitle1" fontWeight={800}>
                            Live Week Preview ({previewWeekDate})
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {recurringDraft.mode === 'math_syllabus'
                            ? `Tuesday = Syllabus Day ${livePreviewCounters.tuesday_math_day ?? 'None'} | Thursday = Syllabus Day ${livePreviewCounters.thursday_math_day ?? 'None'}`
                            : `Calculated Counters for ${previewWeekDate}: Week ${livePreviewCounters.week_num}, Starting Class #${livePreviewCounters.class_num}, Lesson #${livePreviewCounters.lesson_num}`}
                        </Typography>
                      </Box>

                      <TextField
                        size="small"
                        type="date"
                        label="Preview Week (Monday)"
                        value={previewWeekDate}
                        onChange={(e) => setPreviewWeekDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 180, bgcolor: 'background.paper' }}
                      />
                    </Stack>

                    <Grid container spacing={1.5}>
                      {DAY_KEYS.map((dk) => {
                        const dayItem = livePreviewNotes[dk];
                        const hasNoteContent = Boolean(
                          (dayItem.title && dayItem.title.trim()) ||
                            (dayItem.description && dayItem.description.trim())
                        );
                        return (
                          <Grid item xs={12} sm={6} md={2.4} key={dk}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                height: '100%',
                                minHeight: 110,
                                borderRadius: 1.5,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <Typography
                                variant="caption"
                                fontWeight={800}
                                color="primary.main"
                                display="block"
                                mb={0.75}
                                sx={{
                                  borderBottom: '1px solid',
                                  borderColor: 'divider',
                                  pb: 0.5,
                                }}
                              >
                                {DAY_LABELS[dk].toUpperCase()}
                              </Typography>
                              {hasNoteContent ? (
                                <FormattedParentNote
                                  title={dayItem.title}
                                  description={dayItem.description}
                                  color="#1E293B"
                                  iconName="FileText"
                                  interactive={false}
                                />
                              ) : (
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                  fontStyle="italic"
                                >
                                  (Blank)
                                </Typography>
                              )}
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Paper>
                )}
              </Stack>
            </Box>

            {/* Modal Footer */}
            <Box
              px={3}
              py={2}
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1.5,
              }}
            >
              <Button onClick={() => setRecurringSubject(null)} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveRecurringConfig}
                disabled={savingRecurring}
                startIcon={<Save size={16} />}
                sx={{ fontWeight: 700 }}
              >
                {savingRecurring ? 'Saving Rules...' : 'Save Recurring Rules'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* ===================================================================== */}
      {/* EDIT / ADD MATH SYLLABUS DAY MODAL (React 19 safe)                    */}
      {/* ===================================================================== */}
      {editingSyllabusDay && (
        <Box
          onClick={() => {
            setEditingSyllabusDay(null);
            setIsNewSyllabusDay(false);
          }}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Paper
            elevation={12}
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: '100%',
              maxWidth: 600,
              maxHeight: '90vh',
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box px={3} py={2} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={800}>
                {isNewSyllabusDay
                  ? 'Add New Syllabus Day'
                  : `Edit Math Syllabus — Day ${editingSyllabusDay.day_number} (Semester ${editingSyllabusDay.semester === 1 ? '5A' : '5B'})`}
              </Typography>
            </Box>
            <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
              <Stack spacing={2.5}>
                {isNewSyllabusDay && (
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Day Number"
                        value={editingSyllabusDay.day_number}
                        onChange={(e) =>
                          setEditingSyllabusDay({
                            ...editingSyllabusDay,
                            day_number: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        select
                        SelectProps={{ native: true }}
                        fullWidth
                        size="small"
                        label="Semester"
                        value={editingSyllabusDay.semester}
                        onChange={(e) =>
                          setEditingSyllabusDay({
                            ...editingSyllabusDay,
                            semester: Number(e.target.value) === 2 ? 2 : 1,
                          })
                        }
                      >
                        <option value={1}>Semester 1 (Fall 5A)</option>
                        <option value={2}>Semester 2 (Spring 5B)</option>
                      </TextField>
                    </Grid>
                  </Grid>
                )}

                <TextField
                  fullWidth
                  label="Workbook Homework Pages"
                  placeholder="e.g. p. 85-89"
                  value={editingSyllabusDay.workbook}
                  onChange={(e) =>
                    setEditingSyllabusDay({ ...editingSyllabusDay, workbook: e.target.value })
                  }
                  helperText="This is placed on Monday (for Tuesday's class) or Wednesday (for Thursday's class)."
                />
                <TextField
                  fullWidth
                  label="Textbook Pages"
                  placeholder="e.g. p. 90-97"
                  value={editingSyllabusDay.textbook}
                  onChange={(e) =>
                    setEditingSyllabusDay({ ...editingSyllabusDay, textbook: e.target.value })
                  }
                />
                <TextField
                  fullWidth
                  label="Topic"
                  value={editingSyllabusDay.topic}
                  onChange={(e) =>
                    setEditingSyllabusDay({ ...editingSyllabusDay, topic: e.target.value })
                  }
                />
                <TextField
                  fullWidth
                  label="Additional Class Materials to Bring"
                  value={editingSyllabusDay.materials}
                  onChange={(e) =>
                    setEditingSyllabusDay({ ...editingSyllabusDay, materials: e.target.value })
                  }
                />
                <TextField
                  fullWidth
                  label="Fast Facts Drill"
                  value={editingSyllabusDay.fast_facts}
                  onChange={(e) =>
                    setEditingSyllabusDay({ ...editingSyllabusDay, fast_facts: e.target.value })
                  }
                />
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Special Teacher / Homework Notes"
                  value={editingSyllabusDay.notes}
                  onChange={(e) =>
                    setEditingSyllabusDay({ ...editingSyllabusDay, notes: e.target.value })
                  }
                />
              </Stack>
            </Box>
            <Box
              px={3}
              py={2}
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1.5,
              }}
            >
              <Button
                onClick={() => {
                  setEditingSyllabusDay(null);
                  setIsNewSyllabusDay(false);
                }}
                color="inherit"
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveSyllabusDay}
                disabled={savingSyllabusDay}
                startIcon={<Save size={16} />}
                sx={{ fontWeight: 700 }}
              >
                {savingSyllabusDay ? 'Saving...' : 'Save Syllabus Day'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* ===================================================================== */}
      {/* UPLOAD SYLLABUS & AI AUTOMATION BUILDER MODAL (React 19 safe)         */}
      {/* ===================================================================== */}
      {uploadModalOpen && (
        <Box
          onClick={() => !analyzingWithGemini && !applyingAiAutomation && setUploadModalOpen(false)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Paper
            elevation={12}
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: '100%',
              maxWidth: 1080,
              maxHeight: '90vh',
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <Box
              px={3}
              py={2}
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Wand2 size={22} color={theme.palette.primary.main} />
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    Upload Syllabus &amp; AI Automation Builder (Gemini Flash)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Upload an Excel spreadsheet (<code>.xlsx</code>, <code>.csv</code>), PDF (<code>.pdf</code>), or image of a course syllabus to review and build an automation.
                  </Typography>
                </Box>
              </Stack>
              <Button
                size="small"
                color="inherit"
                disabled={analyzingWithGemini || applyingAiAutomation}
                onClick={() => setUploadModalOpen(false)}
                sx={{ fontWeight: 700 }}
              >
                Close
              </Button>
            </Box>

            {/* Modal Body */}
            <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} lg={5}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Stack spacing={2.5}>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                          <Sparkles size={18} color={theme.palette.primary.main} />
                          <Typography variant="subtitle1" fontWeight={800}>
                            1. Select Target Subject &amp; Upload File
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Gemini Flash will review the schedule and automatically generate a recurring weekly automation and syllabus table.
                        </Typography>
                      </Box>

                      <TextField
                        select
                        SelectProps={{ native: true }}
                        fullWidth
                        size="small"
                        label="Target Subject"
                        value={selectedUploadSubjectId}
                        onChange={(e) => setSelectedUploadSubjectId(e.target.value)}
                      >
                        <option value="auto">Auto-Detect Subject from Syllabus</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Update Existing Subject)
                          </option>
                        ))}
                        <option value="new">+ Create a New Subject from Syllabus</option>
                      </TextField>

                      {selectedUploadSubjectId === 'new' && (
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <TextField
                            fullWidth
                            size="small"
                            label="New Subject Name"
                            placeholder="e.g. Literature, Spanish, Chemistry"
                            value={newSubjectNameForUpload}
                            onChange={(e) => setNewSubjectNameForUpload(e.target.value)}
                          />
                          <Box display="flex" alignItems="center" gap={0.75}>
                            <Typography variant="caption" fontWeight={700}>
                              Color:
                            </Typography>
                            <input
                              type="color"
                              value={newSubjectColorForUpload}
                              onChange={(e) => setNewSubjectColorForUpload(e.target.value)}
                              style={{
                                width: 34,
                                height: 34,
                                padding: 0,
                                border: 'none',
                                borderRadius: '50%',
                                cursor: 'pointer',
                              }}
                            />
                          </Box>
                        </Stack>
                      )}

                      <TextField
                        select
                        SelectProps={{ native: true }}
                        fullWidth
                        size="small"
                        label="Semester / Day Numbering"
                        value={semesterOffsetMode}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (
                            val === 'auto' ||
                            val === 'fall_1_32' ||
                            val === 'spring_33_64'
                          ) {
                            setSemesterOffsetMode(val);
                          }
                        }}
                        helperText="For 2-semester syllabi (like Fall 5A vs Spring 5B), choose how Day numbers should map."
                      >
                        <option value="auto">Auto-Detect Semester &amp; Day Numbers</option>
                        <option value="fall_1_32">Fall Semester 1 (Days 1–32)</option>
                        <option value="spring_33_64">Spring Semester 2 (Offset Days 1–32 to Days 33–64)</option>
                      </TextField>

                      {/* Hidden File Input + Dropzone */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.csv,.txt,.pdf,.png,.jpg,.jpeg,.webp"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            handleAnalyzeSyllabusFile(f);
                          }
                          e.target.value = '';
                        }}
                      />

                      <Box
                        onClick={() => !analyzingWithGemini && fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (analyzingWithGemini) return;
                          const f = e.dataTransfer.files?.[0];
                          if (f) {
                            handleAnalyzeSyllabusFile(f);
                          }
                        }}
                        sx={{
                          p: 4,
                          border: '2px dashed',
                          borderColor: analyzingWithGemini ? 'primary.main' : 'divider',
                          borderRadius: 2,
                          textAlign: 'center',
                          cursor: analyzingWithGemini ? 'wait' : 'pointer',
                          bgcolor: 'background.default',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        {analyzingWithGemini ? (
                          <Stack spacing={1.5} alignItems="center">
                            <CircularProgress size={32} />
                            <Typography variant="subtitle2" fontWeight={800}>
                              Analyzing &ldquo;{uploadingFile?.name}&rdquo; with Gemini Flash...
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Extracting recurring weekly patterns, class days, and syllabus assignments
                            </Typography>
                          </Stack>
                        ) : (
                          <Stack spacing={1} alignItems="center">
                            <FileSpreadsheet size={36} color={theme.palette.primary.main} />
                            <Typography variant="subtitle1" fontWeight={800}>
                              Click or Drag &amp; Drop Syllabus File Here
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Supports Excel (<code>.xlsx</code>, <code>.csv</code>), PDF (<code>.pdf</code>), and Images (<code>.png</code>, <code>.jpg</code>)
                            </Typography>
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12} lg={7}>
                  {aiReview ? (
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                      <Stack spacing={2.5}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          spacing={1.5}
                        >
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={0.5}>
                              <CheckCircle2 size={20} color={theme.palette.success.main} />
                              <Typography variant="subtitle1" fontWeight={800}>
                                2. Gemini Flash Syllabus Review
                              </Typography>
                              <Chip
                                label={`Model: ${aiReview.model_used}`}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                              />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              Course: <strong>{aiReview.course_title}</strong>
                              {aiReview.teacher_name ? ` • Instructor: ${aiReview.teacher_name}` : ''}
                            </Typography>
                          </Box>

                          <Chip
                            label={
                              aiReview.recommended_mode === 'math_syllabus'
                                ? 'Recommended: Syllabus-Driven Mode'
                                : 'Recommended: Weekly Template Mode'
                            }
                            color="secondary"
                            size="small"
                            sx={{ fontWeight: 800 }}
                          />
                        </Stack>

                        <Paper
                          variant="outlined"
                          sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}
                        >
                          <Typography variant="body2" fontWeight={600} mb={1}>
                            {aiReview.summary}
                          </Typography>
                          {aiReview.highlights.length > 0 && (
                            <Stack spacing={0.5} mt={1}>
                              {aiReview.highlights.map((h, i) => (
                                <Typography key={i} variant="caption" color="text.secondary">
                                  • {h}
                                </Typography>
                              ))}
                            </Stack>
                          )}
                        </Paper>

                        {/* Weekday Preview from AI */}
                        <Box>
                          <Typography variant="subtitle2" fontWeight={800} mb={1}>
                            Proposed Weekly Schedule Pattern (Mon–Fri)
                          </Typography>
                          <Grid container spacing={1.5}>
                            {DAY_KEYS.map((dk) => {
                              const dCfg = aiReview.recurring_config.days[dk];
                              return (
                                <Grid item xs={12} sm={6} md={2.4} key={dk}>
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      p: 1.25,
                                      borderRadius: 1.5,
                                      height: '100%',
                                      bgcolor: dCfg.enabled ? 'background.paper' : 'action.hover',
                                      opacity: dCfg.enabled ? 1 : 0.65,
                                    }}
                                  >
                                    <Stack
                                      direction="row"
                                      justifyContent="space-between"
                                      alignItems="center"
                                      mb={0.5}
                                    >
                                      <Typography variant="caption" fontWeight={800} color="primary.main">
                                        {DAY_LABELS[dk].slice(0, 3).toUpperCase()}
                                      </Typography>
                                      <Chip
                                        label={dCfg.enabled ? 'ON' : 'OFF'}
                                        size="small"
                                        color={dCfg.enabled ? 'success' : 'default'}
                                        sx={{ height: 16, fontSize: '0.6rem', fontWeight: 800 }}
                                      />
                                    </Stack>
                                    {dCfg.attend_class && (
                                      <Typography variant="caption" fontWeight={700} display="block">
                                        {dCfg.attend_class_label || '• Attend Class'}
                                      </Typography>
                                    )}
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ whiteSpace: 'pre-line', fontSize: '0.68rem' }}
                                    >
                                      {dCfg.template || (dCfg.attend_class ? '' : '—')}
                                    </Typography>
                                  </Paper>
                                </Grid>
                              );
                            })}
                          </Grid>
                        </Box>

                        {/* Extracted Syllabus Days Preview */}
                        {aiReview.syllabus_days.length > 0 && (
                          <Box>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              mb={1}
                            >
                              <Typography variant="subtitle2" fontWeight={800}>
                                Extracted Syllabus Days ({aiReview.syllabus_days.length} Days Found)
                              </Typography>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={importSyllabusRows}
                                    onChange={(e) => setImportSyllabusRows(e.target.checked)}
                                  />
                                }
                                label={
                                  <Typography variant="caption" fontWeight={700}>
                                    Save / Update {aiReview.syllabus_days.length} rows in Syllabus Table
                                  </Typography>
                                }
                              />
                            </Stack>

                            <TableContainer
                              component={Paper}
                              variant="outlined"
                              sx={{ maxHeight: 220, borderRadius: 1.5 }}
                            >
                              <Table stickyHeader size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 800 }}>Day</TableCell>
                                    <TableCell sx={{ fontWeight: 800 }}>Sem</TableCell>
                                    <TableCell sx={{ fontWeight: 800 }}>Workbook HW</TableCell>
                                    <TableCell sx={{ fontWeight: 800 }}>Textbook</TableCell>
                                    <TableCell sx={{ fontWeight: 800 }}>Topic</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {aiReview.syllabus_days.map((sd) => (
                                    <TableRow key={`${sd.semester}-${sd.day_number}`} hover>
                                      <TableCell sx={{ fontWeight: 700 }}>Day {sd.day_number}</TableCell>
                                      <TableCell>Sem {sd.semester}</TableCell>
                                      <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                                        {sd.workbook || '—'}
                                      </TableCell>
                                      <TableCell>{sd.textbook || '—'}</TableCell>
                                      <TableCell>{sd.topic || '—'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Box>
                        )}
                      </Stack>
                    </Paper>
                  ) : (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 4,
                        borderRadius: 2,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Wand2 size={42} color={theme.palette.text.secondary} />
                      <Typography variant="h6" fontWeight={800} mt={2} mb={1}>
                        Ready to Review Your Uploaded Syllabus
                      </Typography>
                      <Typography variant="body2" color="text.secondary" maxWidth={460}>
                        Select or drop a syllabus file on the left to run Gemini Flash analysis. You&apos;ll see a complete summary of detected class days, homework patterns, and extracted syllabus rows before saving.
                      </Typography>
                    </Paper>
                  )}
                </Grid>
              </Grid>
            </Box>

            {/* Modal Footer */}
            <Box
              px={3}
              py={2}
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Box>
                {aiReview && (
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => setAiReview(null)}
                  >
                    Clear AI Review
                  </Button>
                )}
              </Box>
              <Stack direction="row" spacing={1.5}>
                <Button
                  color="inherit"
                  disabled={analyzingWithGemini || applyingAiAutomation}
                  onClick={() => setUploadModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Save size={16} />}
                  disabled={!aiReview || applyingAiAutomation}
                  onClick={handleApplyAiAutomation}
                  sx={{ fontWeight: 700 }}
                >
                  {applyingAiAutomation
                    ? 'Applying Automation...'
                    : 'Create / Apply Automation'}
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

export default function AutomationsPage() {
  return (
    <Suspense
      fallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      }
    >
      <AutomationsContent />
    </Suspense>
  );
}
