'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
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
  Select,
  Skeleton,
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
  Globe,
  RefreshCw,
  Link2,
  FileText,
  KeyRound,
  CloudDownload,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import { FormattedParentNote } from 'src/components/base/formatted-parent-note';
import { StructuredTemplateBlocksEditor } from 'src/components/automations/structured-template-blocks-editor';
import {
  AssignmentTypeConfig,
  DEFAULT_ASSIGNMENT_TYPES,
  generateWeekAssignmentsFromTemplatesAndPolicy,
  RecurringAssignmentTemplate,
  SubjectWithGrading,
} from 'src/utils/gradebook-calculator';
import {
  formatSubItemsForAssignmentInstructions,
  getIsoDateForWeekdayInWeek,
  normalizeWeeklyBlockKey,
  parseRecurringTemplateDayToItems,
  serializeItemsToRecurringTemplateText,
  StructuredCellLineItem,
  syncWeeklySharedBlocksAcrossTemplateDays,
} from 'src/utils/weekly-grading-items';
import {
  ApiSyllabusAutoPopulateConfig,
  ApiSyllabusWeek,
  ApiWeekdayRule,
  ApiWeekdaySplitSource,
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  MathSyllabusDay,
  CourseSyllabusData,
  PortalIntegrationCourseMapping,
  SubjectRecurringConfig,
  createDefaultApiAutoPopulateConfig,
  createDefaultMathConfig,
  formatApiWeekBlockForWeekday,
  generateSubjectWeekNotesStructured,
  getActiveCourseSyllabus,
  getApiSyllabusWeekStartDay,
  getOfficialCourseSubtitle,
  getPreviousWeekdaysBeforeStartDay,
  getSubjectCourseSyllabi,
  parseRecurringConfig,
  resolveApiSyllabusWeekForWeekday,
  resolveSubjectCountersForWeek,
  resolveSyllabusDaySupplies,
} from 'src/utils/recurring-planner';
import type {
  ExtractedSyllabusDayItem,
  ParsedSyllabusReviewPayload,
} from 'src/app/api/automations/parse-syllabus/route';

const API_SPLIT_SOURCE_OPTIONS: Array<{ value: ApiWeekdaySplitSource; label: string }> = [
  { value: 'none', label: 'None (Blank / Custom Only)' },
  { value: 'full_week', label: 'Full Week Schedule' },
  { value: 'day_1', label: 'Day 1 Portion' },
  { value: 'day_2', label: 'Day 2 Portion' },
  { value: 'day_3', label: 'Day 3 Portion' },
  { value: 'day_4', label: 'Day 4 Portion' },
  { value: 'day_5', label: 'Day 5 Portion' },
  { value: 'day_4_and_5', label: 'Days 4 & 5 Combined' },
  { value: 'read_only', label: 'Read Line Only' },
  { value: 'memorize_only', label: 'Memorize Line Only' },
  { value: 'complete_and_do', label: 'Complete & Do Lines' },
];

interface Subject {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  course_code?: string;
  link?: string | null;
  recurring_config?: Json | null;
  grading_config?: Json | null;
}

function AutomationsContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [recurringDraftTemplates, setRecurringDraftTemplates] = useState<
    RecurringAssignmentTemplate[]
  >([]);
  const [activeRecurringDay, setActiveRecurringDay] = useState<DayKey>('monday');
  const [previewWeekDate, setPreviewWeekDate] = useState<string>('2026-10-12');
  const [savingRecurring, setSavingRecurring] = useState(false);

  // Assignment Types & Recurring Assignment Templates State
  const [assignmentTypes, setAssignmentTypes] = useState<AssignmentTypeConfig[]>(
    DEFAULT_ASSIGNMENT_TYPES
  );
  const [recurringTemplates, setRecurringTemplates] = useState<
    RecurringAssignmentTemplate[]
  >([]);

  // Syllabus Filter & Edit State
  const [syllabusSemesterFilter, setSyllabusSemesterFilter] = useState<'all' | 1 | 2>('all');
  const [editingSyllabusDay, setEditingSyllabusDay] = useState<MathSyllabusDay | null>(null);
  const [isNewSyllabusDay, setIsNewSyllabusDay] = useState(false);
  const [savingSyllabusDay, setSavingSyllabusDay] = useState(false);

  // Gemini Flash Syllabus Upload & AI Builder Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedUploadSubjectId, setSelectedUploadSubjectId] = useState<string>('auto');
  const [newSubjectNameForUpload, setNewSubjectNameForUpload] = useState<string>('');
  const [newSubjectColorForUpload, setNewSubjectColorForUpload] = useState<string>('#1b5698');
  const [semesterOffsetMode, setSemesterOffsetMode] = useState<'auto' | 'fall_1_32' | 'spring_33_64'>('auto');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [analyzingWithGemini, setAnalyzingWithGemini] = useState(false);
  const [aiReview, setAiReview] = useState<ParsedSyllabusReviewPayload | null>(null);
  const [importSyllabusRows, setImportSyllabusRows] = useState<boolean>(true);
  const [applyingAiAutomation, setApplyingAiAutomation] = useState(false);

  // API Portal Integration & Course Matcher State (Memoria Academy)
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [portalLoginUrl, setPortalLoginUrl] = useState<string>('https://www.memoriaacademy.com/my-account/');
  const [moodleBaseUrl, setMoodleBaseUrl] = useState<string>('https://mpoa.memoriapress.com');
  const [apiUsername, setApiUsername] = useState<string>('audrey.womble');
  const [apiPassword, setApiPassword] = useState<string>('rascallovesme!');
  const [showApiPassword, setShowApiPassword] = useState(false);
  const [apiStudentName, setApiStudentName] = useState<string>('Audrey Womble');
  const [apiLastSyncedAt, setApiLastSyncedAt] = useState<string>('');
  const [apiCourseMappings, setApiCourseMappings] = useState<PortalIntegrationCourseMapping[]>([]);
  const [discoveringCourses, setDiscoveringCourses] = useState(false);
  const [syncingPortal, setSyncingPortal] = useState(false);

  // API Syllabus Auto-Populate & Week Override State
  const [previewSyllabusWeekNum, setPreviewSyllabusWeekNum] = useState<number>(6);
  const [savingAutoPopulate, setSavingAutoPopulate] = useState(false);
  const [editingApiWeek, setEditingApiWeek] = useState<ApiSyllabusWeek | null>(null);
  const [editingApiWeekText, setEditingApiWeekText] = useState<string>('');
  const [savingApiWeekText, setSavingApiWeekText] = useState(false);
  const [scienceUnitFilter, setScienceUnitFilter] = useState<string>('all');

  async function loadData() {
    setLoadError(null);
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

      const [typesRes, tplRes] = await Promise.all([
        supabase
          .from('assignment_types')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase.from('recurring_assignment_templates').select('*'),
      ]);

      if (typesRes.data && typesRes.data.length > 0) {
        setAssignmentTypes(typesRes.data as AssignmentTypeConfig[]);
      }
      if (tplRes.data) {
        setRecurringTemplates(tplRes.data as RecurringAssignmentTemplate[]);
      }

      // Also load saved API integration config
      const intRes = await fetch('/api/memoria/sync');
      const intJson: unknown = await intRes.json().catch(() => null);
      if (
        intJson &&
        typeof intJson === 'object' &&
        'integration' in intJson &&
        intJson.integration &&
        typeof intJson.integration === 'object'
      ) {
        const pi = intJson.integration as {
          portal_login_url?: string;
          moodle_base_url?: string;
          username?: string;
          password?: string;
          student_fullname?: string;
          last_synced_at?: string;
          course_mappings?: PortalIntegrationCourseMapping[];
        };
        if (pi.portal_login_url) setPortalLoginUrl(pi.portal_login_url);
        if (pi.moodle_base_url) setMoodleBaseUrl(pi.moodle_base_url);
        if (pi.username) setApiUsername(pi.username);
        if (pi.password) setApiPassword(pi.password);
        if (pi.student_fullname) setApiStudentName(pi.student_fullname);
        if (pi.last_synced_at) setApiLastSyncedAt(pi.last_synced_at);
        if (Array.isArray(pi.course_mappings) && pi.course_mappings.length > 0) {
          setApiCourseMappings(pi.course_mappings);
        }
      }
    } catch {
      setLoadError('Could not load automations and syllabus data. Please try again.');
      toast.error('Failed to load automations and syllabus data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingApiWeek && !savingApiWeekText) {
          setEditingApiWeek(null);
        } else if (apiModalOpen && !discoveringCourses && !syncingPortal) {
          setApiModalOpen(false);
        } else if (uploadModalOpen && !analyzingWithGemini && !applyingAiAutomation) {
          setUploadModalOpen(false);
        } else if (editingSyllabusDay && !savingSyllabusDay) {
          setEditingSyllabusDay(null);
          setIsNewSyllabusDay(false);
        } else if (recurringSubject && !savingRecurring) {
          setRecurringSubject(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editingApiWeek,
    savingApiWeekText,
    apiModalOpen,
    discoveringCourses,
    syncingPortal,
    uploadModalOpen,
    analyzingWithGemini,
    applyingAiAutomation,
    editingSyllabusDay,
    savingSyllabusDay,
    recurringSubject,
    savingRecurring,
  ]);

  // Support deep-linking from /subjects-habits or /calendar/planner via ?tab=... or ?subject=...
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'syllabus' || tabParam === 'automations') {
      setActiveTab(tabParam);
    } else if (tabParam === 'upload') {
      setUploadModalOpen(true);
    } else if (tabParam === 'api') {
      setApiModalOpen(true);
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
    const subTemplates = recurringTemplates.filter((t) => t.subject_id === sub.id);
    setRecurringDraftTemplates(subTemplates);
    const firstActive = DAY_KEYS.find((dk) => parsed.days[dk].enabled) || 'monday';
    setActiveRecurringDay(firstActive);
  };

  const handleUpdateRecurringDayItems = (
    dayKey: DayKey,
    nextItems: StructuredCellLineItem[]
  ) => {
    if (!recurringSubject || !recurringDraft) return;

    // 1. Sync weekly-shared blocks across all selected days in recurringDraft.days
    const syncedDays = syncWeeklySharedBlocksAcrossTemplateDays({
      subjectId: recurringSubject.id,
      editedDayKey: dayKey,
      editedItems: nextItems,
      currentDays: recurringDraft.days,
      recurringTemplates: recurringDraftTemplates,
    });

    setRecurringDraft({
      ...recurringDraft,
      days: syncedDays,
    });

    // 2. Sync any Graded blocks into recurringDraftTemplates
    let updatedTpls = [...recurringDraftTemplates];
    const gradedItems = nextItems.filter(
      (it) => it.category === 'graded' && it.text.trim().length > 0
    );
    const seenTemplateIdsOnDay = new Set<string>();

    for (const graded of gradedItems) {
      const cleanTitle = graded.text
        .trim()
        .replace(/^\[WEEKLY[^\]]*\]\s*/i, '')
        .replace(/^-\s*\[[ xX]\]\s*/, '')
        .replace(/^[☐☑•*-]\s*/, '')
        .trim();
      const instructions = formatSubItemsForAssignmentInstructions(
        graded.subItems || [],
        graded.assignmentRecord?.instructions || null
      );

      // If repeatAcrossWeek is true, schedule the recurring graded assignment ONCE per week on the last selected repeat day
      const targetDaysForTpl: DayKey[] = graded.repeatAcrossWeek
        ? (() => {
            const ordered = DAY_KEYS.filter((d) => graded.repeatDays.includes(d));
            const lastDay = ordered[ordered.length - 1] || dayKey;
            return [lastDay];
          })()
        : [dayKey];

      const existingTplId = graded.assignmentRecord?.recurring_template_id;
      const matchedIdx = updatedTpls.findIndex(
        (t) =>
          (existingTplId && t.id === existingTplId) ||
          normalizeWeeklyBlockKey(t.title_template) ===
            normalizeWeeklyBlockKey(cleanTitle)
      );

      if (matchedIdx >= 0) {
        const existing = updatedTpls[matchedIdx];
        seenTemplateIdsOnDay.add(existing.id);
        const mergedDays = graded.repeatAcrossWeek
          ? targetDaysForTpl
          : DAY_KEYS.filter(
              (d) => existing.days_of_week.includes(d) || d === dayKey
            );
        updatedTpls[matchedIdx] = {
          ...existing,
          title_template: cleanTitle,
          instructions_template: instructions || existing.instructions_template || '',
          assignment_type_slug: graded.assignmentCategory || 'homework',
          grading_mode: graded.scoringMode || 'points',
          points_possible: graded.pointsPossible || 100,
          total_problems_default:
            graded.scoringMode === 'problems_calculator'
              ? graded.totalProblems || 20
              : null,
          days_of_week: mergedDays,
          is_active: true,
        };
      } else {
        const newId = `draft-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        seenTemplateIdsOnDay.add(newId);
        updatedTpls.push({
          id: newId,
          subject_id: recurringSubject.id,
          title_template: cleanTitle,
          instructions_template: instructions || '',
          assignment_type_slug: graded.assignmentCategory || 'homework',
          grading_mode: graded.scoringMode || 'points',
          points_possible: graded.pointsPossible || 100,
          total_problems_default:
            graded.scoringMode === 'problems_calculator'
              ? graded.totalProblems || 20
              : null,
          days_of_week: targetDaysForTpl,
          linked_weekly_source: 'weekly_template',
          auto_behavior: 'auto_create',
          estimated_minutes: 30,
          is_active: true,
        });
      }
    }

    // Remove dayKey from any template that was previously on dayKey but was deleted or switched to Info/Verified
    updatedTpls = updatedTpls
      .map((tpl) => {
        if (tpl.linked_weekly_source === 'syllabus_row') return tpl;
        if (seenTemplateIdsOnDay.has(tpl.id)) return tpl;
        if (!tpl.days_of_week.includes(dayKey)) return tpl;
        const remainingDays = tpl.days_of_week.filter((d) => d !== dayKey);
        return {
          ...tpl,
          days_of_week: remainingDays,
          is_active: remainingDays.length > 0,
        };
      })
      .filter((tpl) => tpl.is_active || !tpl.id.startsWith('draft-tpl-'));

    setRecurringDraftTemplates(updatedTpls);
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
        return;
      }

      // Sync recurring_assignment_templates for this subject
      const persistedTemplates: RecurringAssignmentTemplate[] = [];
      for (const tpl of recurringDraftTemplates) {
        if (tpl.id.startsWith('draft-tpl-')) {
          if (!tpl.is_active || tpl.days_of_week.length === 0) continue;
          const { data: inserted } = await supabase
            .from('recurring_assignment_templates')
            .insert({
              subject_id: recurringSubject.id,
              title_template: tpl.title_template,
              instructions_template: tpl.instructions_template,
              assignment_type_slug: tpl.assignment_type_slug,
              grading_mode: tpl.grading_mode,
              points_possible: tpl.points_possible,
              total_problems_default: tpl.total_problems_default,
              days_of_week: tpl.days_of_week,
              linked_weekly_source: tpl.linked_weekly_source,
              auto_behavior: tpl.auto_behavior,
              estimated_minutes: tpl.estimated_minutes,
              is_active: true,
            })
            .select('*')
            .single();
          if (inserted) {
            persistedTemplates.push(inserted as RecurringAssignmentTemplate);
          }
        } else if (!tpl.is_active || tpl.days_of_week.length === 0) {
          await supabase
            .from('recurring_assignment_templates')
            .delete()
            .eq('id', tpl.id);
        } else {
          const { data: updatedRow } = await supabase
            .from('recurring_assignment_templates')
            .update({
              title_template: tpl.title_template,
              instructions_template: tpl.instructions_template,
              assignment_type_slug: tpl.assignment_type_slug,
              grading_mode: tpl.grading_mode,
              points_possible: tpl.points_possible,
              total_problems_default: tpl.total_problems_default,
              days_of_week: tpl.days_of_week,
              is_active: tpl.is_active,
            })
            .eq('id', tpl.id)
            .select('*')
            .single();
          if (updatedRow) {
            persistedTemplates.push(updatedRow as RecurringAssignmentTemplate);
          } else {
            persistedTemplates.push(tpl);
          }
        }
      }

      setRecurringTemplates((prev) => [
        ...prev.filter((t) => t.subject_id !== recurringSubject.id),
        ...persistedTemplates,
      ]);

      setSubjects((prev) =>
        prev.map((s) =>
          s.id === recurringSubject.id
            ? { ...s, recurring_config: recurringDraft as unknown as Json }
            : s
        )
      );
      toast.success(`Saved recurring automation rules for ${recurringSubject.name}!`);
      setRecurringSubject(null);
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

  const handleSwitchSubjectActiveSyllabus = async (sub: Subject, syllabusId: string) => {
    const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
    const syllabi = getSubjectCourseSyllabi(cfg);
    const nextActive = syllabi.find((s) => s.id === syllabusId);
    if (!nextActive) return;

    const nextCfg: SubjectRecurringConfig = {
      ...cfg,
      active_syllabus_id: syllabusId,
      course_syllabus: nextActive,
      course_syllabi: syllabi,
    };
    const jsonCfg = JSON.parse(JSON.stringify(nextCfg)) as Json;
    const { error } = await supabase
      .from('subjects')
      .update({ recurring_config: jsonCfg })
      .eq('id', sub.id);
    if (error) {
      toast.error(`Failed to switch syllabus: ${error.message}`);
      return;
    }
    setSubjects((prev) =>
      prev.map((s) => (s.id === sub.id ? { ...s, recurring_config: jsonCfg } : s))
    );
    setScienceUnitFilter('all');
    toast.success(`Switched ${sub.name} active syllabus to "${nextActive.course_title}"!`);
  };

  const handleDeleteSubjectSyllabus = async (sub: Subject, syllabusId: string) => {
    const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
    const syllabi = getSubjectCourseSyllabi(cfg);
    if (syllabi.length <= 1) {
      toast.error('At least one syllabus must remain in the subject library.');
      return;
    }
    const remaining = syllabi.filter((s) => s.id !== syllabusId);
    const nextActive =
      remaining.find((s) => s.id === cfg.active_syllabus_id) || remaining[0];
    const nextCfg: SubjectRecurringConfig = {
      ...cfg,
      active_syllabus_id: nextActive.id,
      course_syllabus: nextActive,
      course_syllabi: remaining,
    };
    const jsonCfg = JSON.parse(JSON.stringify(nextCfg)) as Json;
    const { error } = await supabase
      .from('subjects')
      .update({ recurring_config: jsonCfg })
      .eq('id', sub.id);
    if (error) {
      toast.error(`Failed to remove syllabus: ${error.message}`);
      return;
    }
    setSubjects((prev) =>
      prev.map((s) => (s.id === sub.id ? { ...s, recurring_config: jsonCfg } : s))
    );
    toast.success(`Removed syllabus from ${sub.name}. Active: "${nextActive.course_title}"`);
  };

  const handleApplyAiAutomation = async () => {
    if (!aiReview) return;
    setApplyingAiAutomation(true);

    try {
      let targetSubject: Subject | null = null;

      const buildRecurringWithSyllabus = (
        subName: string,
        existingConfig?: SubjectRecurringConfig
      ): SubjectRecurringConfig => {
        const title = aiReview.course_title || `${subName} Syllabus`;
        const slugId =
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || `syllabus-${Date.now()}`;

        const courseSyllabusPayload: CourseSyllabusData = {
          id: slugId,
          course_title: title,
          official_course_name: title,
          source_type: 'manual_upload',
          uploaded_file_name: uploadingFile?.name || `${title}.pdf`,
          teacher_name: aiReview.teacher_name || '',
          summary: aiReview.summary || '',
          uploaded_at: new Date().toISOString(),
          days: aiReview.syllabus_days.map((d) => ({
            id: `${slugId}-day-${d.day_number}`,
            day_number: d.day_number,
            week_number: d.week_number ?? Math.ceil(d.day_number / 3),
            unit: d.unit || '',
            activity: d.activity || '',
            semester: d.semester,
            workbook: d.workbook,
            textbook: d.textbook,
            topic: d.topic,
            materials: d.materials,
            fast_facts: d.fast_facts,
            notes: d.notes,
          })),
        };

        const existingSyllabi = existingConfig ? getSubjectCourseSyllabi(existingConfig) : [];
        const updatedSyllabi = [...existingSyllabi];
        const matchIdx = updatedSyllabi.findIndex(
          (s) =>
            s.id === slugId ||
            s.course_title.toLowerCase() === courseSyllabusPayload.course_title.toLowerCase()
        );
        if (matchIdx >= 0) {
          updatedSyllabi[matchIdx] = courseSyllabusPayload;
        } else {
          updatedSyllabi.push(courseSyllabusPayload);
        }

        // Preserve existing 3-class-per-week recurring day templates if the subject already uses {class_num}
        const existingUsesClassNum = existingConfig
          ? DAY_KEYS.some((dk) => existingConfig.days[dk].template.includes('{class_num}'))
          : false;

        return {
          ...(existingUsesClassNum && existingConfig ? existingConfig : aiReview.recurring_config),
          enabled: true,
          active_syllabus_id: courseSyllabusPayload.id,
          course_syllabus: courseSyllabusPayload,
          course_syllabi: updatedSyllabi,
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

        const existingParsedCfg = parseRecurringConfig(existing.recurring_config, existing.name);
        const configToSave = buildRecurringWithSyllabus(existing.name, existingParsedCfg);
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

  // ---------------------------------------------------------------------------
  // MEMORIA ACADEMY API INTEGRATION & SYLLABUS AUTO-POPULATE HANDLERS
  // ---------------------------------------------------------------------------
  const handleDiscoverPortalCourses = async () => {
    setDiscoveringCourses(true);
    try {
      const res = await fetch('/api/memoria/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discover_courses',
          portal_login_url: portalLoginUrl,
          moodle_base_url: moodleBaseUrl,
          username: apiUsername,
          password: apiPassword,
          course_mappings: apiCourseMappings,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        student_fullname?: string;
        course_mappings?: PortalIntegrationCourseMapping[];
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error || 'Failed to authenticate with Memoria Academy portal');
        return;
      }
      if (data.student_fullname) {
        setApiStudentName(data.student_fullname);
      }
      if (Array.isArray(data.course_mappings)) {
        setApiCourseMappings(data.course_mappings);
      }
      toast.success(
        `Connected as ${data.student_fullname || apiUsername}! Found ${
          data.course_mappings?.length || 0
        } enrolled courses.`
      );
    } catch {
      toast.error('Failed to connect to Memoria Academy portal');
    } finally {
      setDiscoveringCourses(false);
    }
  };

  const handleSyncPortalCourses = async (closeModalOnSuccess = true) => {
    setSyncingPortal(true);
    try {
      const res = await fetch('/api/memoria/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_courses',
          portal_login_url: portalLoginUrl,
          moodle_base_url: moodleBaseUrl,
          username: apiUsername,
          password: apiPassword,
          course_mappings: apiCourseMappings,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        synced_at?: string;
        student_fullname?: string;
        synced_courses?: Array<{
          moodle_course_id: number;
          official_course_name: string;
          subject_id: string;
          subject_name: string;
          weeks_count: number;
          graded_items_count: number;
          course_total_percentage: number | null;
        }>;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error || 'Failed to sync courses from Memoria Academy');
        return;
      }

      if (data.synced_at) setApiLastSyncedAt(data.synced_at);
      if (data.student_fullname) setApiStudentName(data.student_fullname);

      await loadData();

      const syncedList = data.synced_courses || [];
      toast.success(
        `Synced ${syncedList.length} Memoria Academy courses (${syncedList
          .map((c) => `${c.official_course_name}: ${c.weeks_count} wks`)
          .join(', ')})!`
      );

      if (closeModalOnSuccess) {
        setApiModalOpen(false);
        if (syncedList.length > 0) {
          setActiveTab('syllabus');
          setActiveSyllabusSubTab(syncedList[0].subject_id);
        }
      }
    } catch {
      toast.error('Failed to sync Memoria Academy courses');
    } finally {
      setSyncingPortal(false);
    }
  };

  const handleUpdateSubjectApiAutoPopulate = async (
    sub: Subject,
    updaterOrValue:
      | ApiSyllabusAutoPopulateConfig
      | ((prev: ApiSyllabusAutoPopulateConfig) => ApiSyllabusAutoPopulateConfig),
    showToast: boolean | string = false
  ) => {
    const rec = parseRecurringConfig(sub.recurring_config, sub.name);
    if (!rec.course_syllabus) return;
    const currentAuto =
      rec.course_syllabus.api_auto_populate ||
      createDefaultApiAutoPopulateConfig(sub.name, rec.course_syllabus.course_title);
    const nextAuto =
      typeof updaterOrValue === 'function' ? updaterOrValue(currentAuto) : updaterOrValue;

    const nextRec: SubjectRecurringConfig = {
      ...rec,
      enabled: nextAuto.enabled ? true : rec.enabled,
      course_syllabus: {
        ...rec.course_syllabus,
        api_auto_populate: nextAuto,
      },
    };

    setSubjects((prev) =>
      prev.map((item) =>
        item.id === sub.id ? { ...item, recurring_config: nextRec as unknown as Json } : item
      )
    );

    if (showToast) setSavingAutoPopulate(true);
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ recurring_config: nextRec as unknown as Json })
        .eq('id', sub.id);
      if (error) {
        toast.error(`Failed to save Auto-Populate settings: ${error.message}`);
      } else if (showToast) {
        toast.success(
          typeof showToast === 'string'
            ? showToast
            : `Saved Auto-Populate rules for ${sub.name}!`
        );
      }
    } finally {
      if (showToast) setSavingAutoPopulate(false);
    }
  };

  const handleSaveApiWeekOverrideText = async () => {
    const sub = subjects.find((s) => s.id === activeSyllabusSubTab);
    if (!editingApiWeek || !sub) return;
    const rec = parseRecurringConfig(sub.recurring_config, sub.name);
    if (!rec.course_syllabus?.weeks) return;

    setSavingApiWeekText(true);
    try {
      const trimmed = editingApiWeekText.trim();
      const updatedWeeks = rec.course_syllabus.weeks.map((w) => {
        if (w.week_number !== editingApiWeek.week_number) return w;
        return {
          ...w,
          custom_override_text:
            trimmed && trimmed !== w.raw_summary.trim() ? trimmed : undefined,
        };
      });

      const nextRec: SubjectRecurringConfig = {
        ...rec,
        course_syllabus: {
          ...rec.course_syllabus,
          weeks: updatedWeeks,
        },
      };

      const { error } = await supabase
        .from('subjects')
        .update({ recurring_config: nextRec as unknown as Json })
        .eq('id', sub.id);

      if (error) {
        toast.error(`Failed to update Week ${editingApiWeek.week_number}: ${error.message}`);
      } else {
        setSubjects((prev) =>
          prev.map((item) =>
            item.id === sub.id ? { ...item, recurring_config: nextRec as unknown as Json } : item
          )
        );
        toast.success(`Updated Week ${editingApiWeek.week_number} schedule text!`);
        setEditingApiWeek(null);
      }
    } finally {
      setSavingApiWeekText(false);
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

  const livePreviewAssignmentsByDay = useMemo(() => {
    if (!recurringSubject || !recurringDraft || !livePreviewCounters) return null;
    const weekDates = DAY_KEYS.map((dk) => ({
      dateStr: getIsoDateForWeekdayInWeek(previewWeekDate, dk),
      dayKey: dk,
      dayName: DAY_LABELS[dk],
    }));
    const candidates = generateWeekAssignmentsFromTemplatesAndPolicy({
      subject: recurringSubject as SubjectWithGrading,
      recurringConfig: recurringDraft,
      counters: livePreviewCounters,
      weekDates,
      syllabusMap,
      templates: recurringDraftTemplates,
    });
    const byDay: Record<DayKey, typeof candidates> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
    };
    for (const c of candidates) {
      const matchedDay = weekDates.find((w) => w.dateStr === c.due_date)?.dayKey;
      if (matchedDay) {
        byDay[matchedDay].push(c);
      }
    }
    return byDay;
  }, [
    recurringSubject,
    recurringDraft,
    livePreviewCounters,
    previewWeekDate,
    syllabusMap,
    recurringDraftTemplates,
  ]);

  if (loading) {
    return (
      <Stack spacing={2.5}>
        <Skeleton variant="rounded" height={88} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rounded" height={520} sx={{ borderRadius: 1 }} />
      </Stack>
    );
  }

  return (
    <Box>
      {loadError && (
        <Alert
          severity="error"
          sx={{ mb: 2.5, borderRadius: 1 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setLoading(true);
                void loadData();
              }}
              sx={{ fontWeight: 700, textTransform: 'none' }}
            >
              Retry
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {/* Unified Page Header Bar */}
      <Card
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 1,
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
              Toggle recurring weekday templates, manage manually uploaded syllabi, or sync online courses &amp; grades via API.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<CheckCircle2 size={15} />}
              onClick={() => router.push('/gradebook')}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 1,
                px: 1.75,
                py: 0.75,
                borderColor: 'divider',
                color: 'text.primary',
              }}
            >
              Staging &amp; Gradebook Rules
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<BookOpen size={15} />}
              onClick={() => router.push('/subjects-habits')}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 1,
                px: 1.75,
                py: 0.75,
                borderColor: 'divider',
                color: 'text.primary',
              }}
            >
              Subjects &amp; Habits
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CloudDownload size={15} color={theme.palette.primary.main} />}
              onClick={() => setApiModalOpen(true)}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 1,
                px: 1.75,
                py: 0.75,
                borderColor: 'divider',
                color: 'text.primary',
              }}
            >
              API Integration (Memoria Academy)
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
                borderRadius: 1,
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
          borderRadius: 1,
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
                  const officialCourseName = getOfficialCourseSubtitle(recConfig);
                  const isApiSynced =
                    recConfig.course_syllabus?.source_type === 'api_sync' &&
                    Array.isArray(recConfig.course_syllabus?.weeks) &&
                    recConfig.course_syllabus.weeks.length > 0;
                  const apiAutoPop = recConfig.course_syllabus?.api_auto_populate;

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
                      : isApiSynced && apiAutoPop?.enabled
                      ? DAY_KEYS.filter((dk) => {
                          const rule = apiAutoPop.weekday_rules[dk];
                          return (
                            (rule &&
                              (rule.api_source !== 'none' ||
                                rule.attend_class ||
                                Boolean(rule.custom_additional_lines.trim()))) ||
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
                        borderRadius: 1,
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
                          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 175 }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: sub.color || '#1b5698',
                                flexShrink: 0,
                              }}
                            />
                            <Box>
                              <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                                {sub.name}
                              </Typography>
                              {officialCourseName && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontStyle: 'italic',
                                    color: 'text.secondary',
                                    fontWeight: 500,
                                    display: 'block',
                                    fontSize: '0.75rem',
                                    mt: 0.15,
                                  }}
                                >
                                  {officialCourseName}
                                </Typography>
                              )}
                            </Box>
                          </Stack>

                          <Chip
                            icon={
                              recConfig.mode === 'math_syllabus' ? (
                                <Calculator size={12} />
                              ) : isApiSynced ? (
                                <CloudDownload size={12} />
                              ) : (
                                <Repeat size={12} />
                              )
                            }
                            label={
                              recConfig.mode === 'math_syllabus'
                                ? '64-Day Syllabus'
                                : isApiSynced
                                ? `API Sync'd (${recConfig.course_syllabus?.weeks?.length || 0} Wks)`
                                : 'Weekly Template'
                            }
                            size="small"
                            color={
                              recConfig.mode === 'math_syllabus'
                                ? 'secondary'
                                : isApiSynced
                                ? 'info'
                                : 'primary'
                            }
                            variant="outlined"
                            onClick={() => {
                              if (isApiSynced) {
                                setActiveTab('syllabus');
                                setActiveSyllabusSubTab(sub.id);
                              } else {
                                handleOpenRecurringModal(sub);
                              }
                            }}
                            sx={{ fontWeight: 600, fontSize: '0.75rem', height: 24, cursor: 'pointer' }}
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
                                    height: 22,
                                    fontSize: '0.75rem',
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
                              borderRadius: 1,
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
                      borderRadius: 1,
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
                  sx={{ borderRadius: 1, py: 1, gap: 1.25, fontSize: '0.875rem', fontWeight: 600 }}
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
                        sx={{ borderRadius: 1, py: 1, gap: 1.25, fontSize: '0.875rem', fontWeight: 500 }}
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
                  sx={{ borderRadius: 1, py: 1, gap: 1.25, fontSize: '0.875rem', fontWeight: 500 }}
                >
                  <Wand2 size={15} />
                  Upload Syllabus with AI…
                </MenuItem>
              </Menu>
            </Box>
          )}

          {/* =============================================================== */}
          {/* TAB 2: SYLLABI (NESTED MANUALLY UPLOADED & API SYNC'D SYLLABI)  */}
          {/* =============================================================== */}
          {activeTab === 'syllabus' && (
            <Box>
              {/* Syllabus Selector Dropdown & Quick Sync Actions Bar */}
              <Box
                sx={{
                  mb: 3,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                {(() => {
                  const syllabusSubjects = subjects.filter((sub) => {
                    const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
                    return cfg.mode !== 'math_syllabus' && Boolean(cfg.course_syllabus);
                  });
                  const selectedSub =
                    activeSyllabusSubTab === 'math'
                      ? null
                      : syllabusSubjects.find((s) => s.id === activeSyllabusSubTab) || null;
                  const selectedCfg = selectedSub
                    ? parseRecurringConfig(selectedSub.recurring_config, selectedSub.name)
                    : null;
                  const selectedSyl = selectedCfg?.course_syllabus;
                  const isSelectedApi = selectedSyl?.source_type === 'api_sync';

                  return (
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.25}
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                      sx={{ flex: 1, minWidth: { xs: '100%', sm: 320 }, maxWidth: { sm: 560 } }}
                    >
                      <TextField
                        select
                        size="small"
                        label="Select Course Syllabus"
                        value={activeSyllabusSubTab}
                        onChange={(e) => setActiveSyllabusSubTab(e.target.value)}
                        fullWidth
                        sx={{
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          '& .MuiSelect-select': {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          },
                        }}
                      >
                        <MenuItem value="math" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ width: '100%' }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Calculator size={15} />
                              <span>Math — Dimensions Math 5 ({syllabusDays.length} Days)</span>
                            </Stack>
                            <Chip
                              label="Manual Upload"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                ml: 1,
                                bgcolor: alpha(theme.palette.warning.main, 0.14),
                                color: theme.palette.warning.dark,
                              }}
                            />
                          </Stack>
                        </MenuItem>

                        {syllabusSubjects.map((sub) => {
                          const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
                          const syl = cfg.course_syllabus;
                          const isApi = syl?.source_type === 'api_sync';
                          const countLabel =
                            isApi && syl?.weeks?.length
                              ? `${syl.weeks.length} Wks`
                              : syl?.days?.length
                              ? `${syl.days.length} Days`
                              : '';
                          return (
                            <MenuItem
                              key={sub.id}
                              value={sub.id}
                              sx={{ fontWeight: 700, fontSize: '0.85rem' }}
                            >
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ width: '100%' }}
                              >
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Box
                                    sx={{
                                      width: 9,
                                      height: 9,
                                      borderRadius: '50%',
                                      bgcolor: sub.color || '#1b5698',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span>
                                    {sub.name}
                                    {syl?.official_course_name
                                      ? ` — ${syl.official_course_name}`
                                      : ''}
                                    {countLabel ? ` (${countLabel})` : ''}
                                  </span>
                                </Stack>
                                <Chip
                                  label={isApi ? "API Sync'd" : 'Manual Upload'}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    ml: 1,
                                    bgcolor: isApi
                                      ? alpha(theme.palette.info.main, 0.14)
                                      : alpha(theme.palette.warning.main, 0.14),
                                    color: isApi
                                      ? theme.palette.info.dark
                                      : theme.palette.warning.dark,
                                  }}
                                />
                              </Stack>
                            </MenuItem>
                          );
                        })}
                      </TextField>

                      <Chip
                        label={
                          activeSyllabusSubTab === 'math'
                            ? 'Manual Upload'
                            : isSelectedApi
                            ? "API Sync'd"
                            : 'Manual Upload'
                        }
                        size="small"
                        sx={{
                          height: 26,
                          fontSize: '0.73rem',
                          fontWeight: 800,
                          flexShrink: 0,
                          alignSelf: { xs: 'flex-start', sm: 'center' },
                          bgcolor:
                            activeSyllabusSubTab !== 'math' && isSelectedApi
                              ? alpha(theme.palette.info.main, 0.14)
                              : alpha(theme.palette.warning.main, 0.14),
                          color:
                            activeSyllabusSubTab !== 'math' && isSelectedApi
                              ? theme.palette.info.dark
                              : theme.palette.warning.dark,
                        }}
                      />
                    </Stack>
                  );
                })()}

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    startIcon={<CloudDownload size={14} />}
                    onClick={() => setApiModalOpen(true)}
                    sx={{
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    API Portal Sync
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    startIcon={<Wand2 size={14} />}
                    onClick={() => setUploadModalOpen(true)}
                    sx={{
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    + Upload Syllabus (AI)
                  </Button>
                </Stack>
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
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={0.5}>
                        <Typography variant="h6" fontWeight={800}>
                          Dimensions Math® Level 5 (5A &amp; 5B) Syllabus
                        </Typography>
                        <Chip
                          icon={<Upload size={12} />}
                          label="Manually Uploaded"
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ fontWeight: 800, fontSize: '0.75rem', height: 22 }}
                        />
                        <Chip
                          icon={<FileSpreadsheet size={12} />}
                          label="Source Doc: Dimensions Math 5A & 5B Syllabus (Amanda Holiday).pdf"
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                        />
                      </Stack>
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

                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 640, borderRadius: 1 }}>
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
                            <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Day {day.day_number}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Chip
                                label={day.semester === 1 ? '5A (Fall)' : '5B (Spring)'}
                                size="small"
                                color={day.semester === 1 ? 'primary' : 'secondary'}
                                variant="outlined"
                                sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {day.workbook || '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>{day.textbook || '—'}</TableCell>
                            <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{day.topic}</TableCell>
                            <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                              {day.materials || '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>{day.fast_facts || '—'}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label={`Edit Day ${day.day_number}`}
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
                  const subjectSyllabi = getSubjectCourseSyllabi(subCfg);
                  const courseSyl = getActiveCourseSyllabus(subCfg);
                  if (!courseSyl) return null;

                  const isApiSyllabus =
                    courseSyl.source_type === 'api_sync' &&
                    Array.isArray(courseSyl.weeks) &&
                    courseSyl.weeks.length > 0;
                  const apiWeeks = courseSyl.weeks || [];
                  const apiAutoPop =
                    courseSyl.api_auto_populate ||
                    createDefaultApiAutoPopulateConfig(
                      selectedSub.name,
                      courseSyl.official_course_name || courseSyl.course_title
                    );
                  const selectedPreviewWeekObj =
                    apiWeeks.find((w) => w.week_number === previewSyllabusWeekNum) ||
                    apiWeeks[0] ||
                    null;

                  return (
                    <Box>
                      {/* Syllabus Header with Source Badge */}
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        spacing={2}
                        mb={2.5}
                      >
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={0.5}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: selectedSub.color || '#1b5698',
                              }}
                            />
                            <Typography variant="h6" fontWeight={800}>
                              {selectedSub.name} — {courseSyl.official_course_name || courseSyl.course_title}
                            </Typography>
                            {isApiSyllabus ? (
                              <>
                                <Chip
                                  icon={<CloudDownload size={12} />}
                                  label="API Sync'd (Memoria Academy)"
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                  sx={{ fontWeight: 800, fontSize: '0.75rem', height: 22 }}
                                />
                                {courseSyl.moodle_course_shortname && (
                                  <Chip
                                    label={`Code: ${courseSyl.moodle_course_shortname}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22 }}
                                  />
                                )}
                              </>
                            ) : (
                              <>
                                <Chip
                                  icon={<Upload size={12} />}
                                  label="Manually Uploaded"
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ fontWeight: 800, fontSize: '0.75rem', height: 22 }}
                                />
                                <Chip
                                  icon={<FileSpreadsheet size={12} />}
                                  label={`Source Doc: ${courseSyl.uploaded_file_name || `${courseSyl.course_title}.pdf`}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                                />
                                {subjectSyllabi.length > 1 && (
                                  <Chip
                                    label={`${subjectSyllabi.length} Syllabi in Library`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{ fontWeight: 800, fontSize: '0.75rem', height: 22 }}
                                  />
                                )}
                              </>
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {courseSyl.teacher_name ? `Instructor: ${courseSyl.teacher_name} • ` : ''}
                            {courseSyl.summary || 'Course syllabus'}
                            {courseSyl.last_synced_at
                              ? ` • Last Synced: ${new Date(courseSyl.last_synced_at).toLocaleString()}`
                              : ''}
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {isApiSyllabus ? (
                            <>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<RefreshCw size={14} />}
                                disabled={syncingPortal}
                                onClick={() => handleSyncPortalCourses(false)}
                                sx={{ fontWeight: 700, textTransform: 'none' }}
                              >
                                {syncingPortal ? 'Syncing Portal...' : 'Sync Portal Now'}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                startIcon={<Link2 size={14} />}
                                onClick={() => setApiModalOpen(true)}
                                sx={{ fontWeight: 700, textTransform: 'none' }}
                              >
                                Portal Credentials &amp; Mapping
                              </Button>
                            </>
                          ) : (
                            <>
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
                                + Upload Another Syllabus for {selectedSub.name}
                              </Button>
                            </>
                          )}
                        </Stack>
                      </Stack>

                      {/* Multi-Syllabus Library Bar for subjects like Science */}
                      {!isApiSyllabus && subjectSyllabi.length > 0 && (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.75,
                            mb: 2.5,
                            borderRadius: 1,
                            bgcolor: 'background.default',
                          }}
                        >
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            spacing={1.5}
                          >
                            <Box>
                              <Typography variant="caption" fontWeight={800} color="text.secondary">
                                {selectedSub.name.toUpperCase()} SYLLABI LIBRARY ({subjectSyllabi.length} STORED) — SELECT ACTIVE SYLLABUS FOR WEEKLY PLANNER:
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={0.75}>
                                {subjectSyllabi.map((sylItem, idx) => {
                                  const sylId = sylItem.id || `syllabus-${idx + 1}`;
                                  const isActiveSyl =
                                    (courseSyl.id && courseSyl.id === sylId) ||
                                    courseSyl.course_title === sylItem.course_title;
                                  return (
                                    <Stack key={sylId} direction="row" spacing={0.5} alignItems="center">
                                      <Button
                                        size="small"
                                        variant={isActiveSyl ? 'contained' : 'outlined'}
                                        color={isActiveSyl ? 'success' : 'inherit'}
                                        startIcon={isActiveSyl ? <CheckCircle2 size={14} /> : <BookOpen size={14} />}
                                        onClick={() => handleSwitchSubjectActiveSyllabus(selectedSub, sylId)}
                                        sx={{
                                          fontWeight: 700,
                                          textTransform: 'none',
                                          borderRadius: 1,
                                        }}
                                      >
                                        {sylItem.course_title} ({sylItem.days.length} classes)
                                      </Button>
                                      {subjectSyllabi.length > 1 && (
                                        <IconButton
                                          size="small"
                                          color="error"
                                          title={`Remove ${sylItem.course_title}`}
                                          onClick={() => handleDeleteSubjectSyllabus(selectedSub, sylId)}
                                        >
                                          <Trash2 size={14} />
                                        </IconButton>
                                      )}
                                    </Stack>
                                  );
                                })}
                              </Stack>
                            </Box>
                          </Stack>
                        </Paper>
                      )}

                      {isApiSyllabus ? (
                        <Stack spacing={3}>
                          {/* =================================================== */}
                          {/* AUTO-POPULATE INTO WEEKLY PLANNER SECTION           */}
                          {/* =================================================== */}
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 2.5,
                              borderRadius: 1,
                              borderColor: apiAutoPop.enabled
                                ? alpha(theme.palette.primary.main, 0.45)
                                : 'divider',
                              bgcolor: apiAutoPop.enabled
                                ? alpha(theme.palette.primary.main, 0.02)
                                : 'background.default',
                            }}
                          >
                            <Stack
                              direction={{ xs: 'column', md: 'row' }}
                              justifyContent="space-between"
                              alignItems={{ xs: 'flex-start', md: 'center' }}
                              spacing={2}
                              mb={2}
                            >
                              <Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Sparkles size={16} color={theme.palette.primary.main} />
                                  <Typography variant="subtitle1" fontWeight={800}>
                                    Auto-Populate Weekly Schedule into Planner
                                  </Typography>
                                  <Chip
                                    label={apiAutoPop.enabled ? 'AUTO-POPULATE ON' : 'PAUSED'}
                                    size="small"
                                    color={apiAutoPop.enabled ? 'success' : 'default'}
                                    sx={{ fontWeight: 800, fontSize: '0.75rem', height: 20 }}
                                  />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  Choose how each week&apos;s online schedule from Memoria Academy is split across Monday–Friday when you select a Week # in the Weekly Planner.
                                </Typography>
                              </Box>

                              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                                    Syllabus Week Starts On (Day 1):
                                  </Typography>
                                  <TextField
                                    select
                                    SelectProps={{ native: true }}
                                    size="small"
                                    value={getApiSyllabusWeekStartDay(apiAutoPop)}
                                    onChange={(e) => {
                                      const nextStartDay = e.target.value as DayKey;
                                      const nextAuto: ApiSyllabusAutoPopulateConfig = {
                                        ...apiAutoPop,
                                        week_start_day: nextStartDay,
                                      };
                                      void handleUpdateSubjectApiAutoPopulate(
                                        selectedSub,
                                        nextAuto,
                                        `Syllabus week start day set to ${DAY_LABELS[nextStartDay]} for ${selectedSub.name}`
                                      );
                                    }}
                                    sx={{ minWidth: 120 }}
                                  >
                                    {DAY_KEYS.map((dk) => (
                                      <option key={dk} value={dk}>
                                        {DAY_LABELS[dk]}
                                      </option>
                                    ))}
                                  </TextField>
                                </Stack>

                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                                    Place Weekly Quiz/Assignment On:
                                  </Typography>
                                  <TextField
                                    select
                                    SelectProps={{ native: true }}
                                    size="small"
                                    value={apiAutoPop.quiz_assignment_target_day}
                                    onChange={(e) => {
                                      const nextAuto: ApiSyllabusAutoPopulateConfig = {
                                        ...apiAutoPop,
                                        quiz_assignment_target_day: e.target.value as DayKey,
                                      };
                                      void handleUpdateSubjectApiAutoPopulate(selectedSub, nextAuto);
                                    }}
                                    sx={{ minWidth: 120 }}
                                  >
                                    {DAY_KEYS.map((dk) => (
                                      <option key={dk} value={dk}>
                                        {DAY_LABELS[dk]}
                                      </option>
                                    ))}
                                  </TextField>
                                </Stack>

                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={apiAutoPop.enabled}
                                      onChange={(e) => {
                                        const nextAuto: ApiSyllabusAutoPopulateConfig = {
                                          ...apiAutoPop,
                                          enabled: e.target.checked,
                                        };
                                        void handleUpdateSubjectApiAutoPopulate(
                                          selectedSub,
                                          nextAuto,
                                          `Auto-populate ${e.target.checked ? 'enabled' : 'paused'} for ${selectedSub.name}`
                                        );
                                      }}
                                      color="success"
                                    />
                                  }
                                  label={
                                    <Typography variant="body2" fontWeight={700}>
                                      {apiAutoPop.enabled ? 'Enabled' : 'Disabled'}
                                    </Typography>
                                  }
                                />
                              </Stack>
                            </Stack>

                            {(() => {
                              const startDay = getApiSyllabusWeekStartDay(apiAutoPop);
                              if (startDay === 'monday') return null;
                              const prevDays = getPreviousWeekdaysBeforeStartDay(startDay, apiAutoPop);
                              return (
                                <Box
                                  sx={{
                                    mb: 2,
                                    p: 1.25,
                                    borderRadius: 1,
                                    bgcolor: alpha(theme.palette.warning.main, 0.08),
                                    border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
                                  }}
                                >
                                  <Typography variant="caption" color="text.primary" sx={{ fontSize: '0.76rem' }}>
                                    <strong>2-Week Syllabus Span Active:</strong> Because Day 1 of this class starts on{' '}
                                    <strong>{DAY_LABELS[startDay]}</strong>, selecting <strong>Week N</strong> in the
                                    Weekly Binder will pull{' '}
                                    <strong>{prevDays.map((d) => DAY_LABELS[d]).join(', ')}</strong> from the previous
                                    syllabus week (<strong>Week N &minus; 1</strong>) and start{' '}
                                    <strong>Week N (Day 1)</strong> on <strong>{DAY_LABELS[startDay]}</strong>.
                                  </Typography>
                                </Box>
                              );
                            })()}

                            {/* 5-Day Weekday Split Configuration Grid */}
                            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                              {DAY_KEYS.map((dk) => {
                                const rule = apiAutoPop.weekday_rules[dk];
                                const isQuizDay = apiAutoPop.quiz_assignment_target_day === dk;
                                const startDay = getApiSyllabusWeekStartDay(apiAutoPop);
                                const isSpanning = startDay !== 'monday';
                                const isBeforeStartDay =
                                  isSpanning && DAY_KEYS.indexOf(dk) < DAY_KEYS.indexOf(startDay);
                                const isStartDay = isSpanning && dk === startDay;
                                return (
                                  <Grid item xs={12} sm={6} md={2.4} key={dk}>
                                    <Paper
                                      variant="outlined"
                                      sx={{
                                        p: 1.5,
                                        borderRadius: 1,
                                        height: '100%',
                                        bgcolor: 'background.paper',
                                        borderColor:
                                          rule.api_source !== 'none' ||
                                          rule.attend_class ||
                                          Boolean(rule.custom_additional_lines.trim())
                                            ? alpha(theme.palette.primary.main, 0.4)
                                            : 'divider',
                                      }}
                                    >
                                      <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        mb={1}
                                        flexWrap="wrap"
                                        gap={0.5}
                                      >
                                        <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
                                          {DAY_LABELS[dk]}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                          {isBeforeStartDay && rule.api_source !== 'none' && (
                                            <Chip
                                              label="Prev Wk (N-1)"
                                              size="small"
                                              color="warning"
                                              variant="outlined"
                                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }}
                                            />
                                          )}
                                          {isStartDay && (
                                            <Chip
                                              label="Starts Wk N"
                                              size="small"
                                              color="primary"
                                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }}
                                            />
                                          )}
                                          {isQuizDay && (
                                            <Chip
                                              label="Quiz Day"
                                              size="small"
                                              color="secondary"
                                              sx={{ height: 20, fontSize: '0.75rem', fontWeight: 800 }}
                                            />
                                          )}
                                        </Stack>
                                      </Stack>

                                      <Stack spacing={1}>
                                        <Box>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            fontWeight={700}
                                            display="block"
                                            mb={0.35}
                                            sx={{ fontSize: '0.75rem' }}
                                          >
                                            API Schedule Portion
                                          </Typography>
                                          <TextField
                                            select
                                            SelectProps={{ native: true }}
                                            fullWidth
                                            size="small"
                                            value={rule.api_source}
                                            onChange={(e) => {
                                              const nextSrc = e.target.value as ApiWeekdaySplitSource;
                                              const nextAuto: ApiSyllabusAutoPopulateConfig = {
                                                ...apiAutoPop,
                                                ...(nextSrc === 'day_1' ? { week_start_day: dk } : {}),
                                                weekday_rules: {
                                                  ...apiAutoPop.weekday_rules,
                                                  [dk]: {
                                                    ...rule,
                                                    enabled:
                                                      nextSrc !== 'none' ||
                                                      rule.attend_class ||
                                                      Boolean(rule.custom_additional_lines.trim()),
                                                    api_source: nextSrc,
                                                  },
                                                },
                                              };
                                              void handleUpdateSubjectApiAutoPopulate(selectedSub, nextAuto);
                                            }}
                                          >
                                            {API_SPLIT_SOURCE_OPTIONS.map((opt) => (
                                              <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                              </option>
                                            ))}
                                          </TextField>
                                        </Box>

                                        <FormControlLabel
                                          sx={{ m: 0 }}
                                          control={
                                            <Checkbox
                                              size="small"
                                              checked={rule.attend_class}
                                              onChange={(e) => {
                                                const nextAuto: ApiSyllabusAutoPopulateConfig = {
                                                  ...apiAutoPop,
                                                  weekday_rules: {
                                                    ...apiAutoPop.weekday_rules,
                                                    [dk]: {
                                                      ...rule,
                                                      enabled: e.target.checked ? true : rule.enabled,
                                                      attend_class: e.target.checked,
                                                    },
                                                  },
                                                };
                                                void handleUpdateSubjectApiAutoPopulate(selectedSub, nextAuto);
                                              }}
                                              sx={{ p: 0.4 }}
                                            />
                                          }
                                          label={
                                            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem' }}>
                                              Include &ldquo;Attend Class&rdquo; Header
                                            </Typography>
                                          }
                                        />

                                        <FormControlLabel
                                          sx={{ m: 0 }}
                                          control={
                                            <Checkbox
                                              size="small"
                                              checked={rule.format_as_checkboxes}
                                              onChange={(e) => {
                                                const nextAuto: ApiSyllabusAutoPopulateConfig = {
                                                  ...apiAutoPop,
                                                  weekday_rules: {
                                                    ...apiAutoPop.weekday_rules,
                                                    [dk]: {
                                                      ...rule,
                                                      format_as_checkboxes: e.target.checked,
                                                    },
                                                  },
                                                };
                                                void handleUpdateSubjectApiAutoPopulate(selectedSub, nextAuto);
                                              }}
                                              sx={{ p: 0.4 }}
                                            />
                                          }
                                          label={
                                            <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                                              Format API lines as checkboxes
                                            </Typography>
                                          }
                                        />

                                        <TextField
                                          size="small"
                                          fullWidth
                                          multiline
                                          minRows={2}
                                          label="Additional Recurring Lines"
                                          placeholder="- [ ] Memory Work"
                                          defaultValue={rule.custom_additional_lines}
                                          onBlur={(e) => {
                                            if (e.target.value === rule.custom_additional_lines) return;
                                            const nextAuto: ApiSyllabusAutoPopulateConfig = {
                                              ...apiAutoPop,
                                              weekday_rules: {
                                                ...apiAutoPop.weekday_rules,
                                                [dk]: {
                                                  ...rule,
                                                  enabled:
                                                    Boolean(e.target.value.trim()) ||
                                                    rule.api_source !== 'none' ||
                                                    rule.attend_class,
                                                  custom_additional_lines: e.target.value,
                                                },
                                              },
                                            };
                                            void handleUpdateSubjectApiAutoPopulate(selectedSub, nextAuto);
                                          }}
                                          InputProps={{ sx: { fontSize: '0.75rem' } }}
                                          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                                        />
                                      </Stack>
                                    </Paper>
                                  </Grid>
                                );
                              })}
                            </Grid>

                            {/* Live Week Preview inside Auto-Populate Card */}
                            {selectedPreviewWeekObj && (
                              <Box
                                sx={{
                                  p: 2,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                }}
                              >
                                <Stack
                                  direction={{ xs: 'column', sm: 'row' }}
                                  justifyContent="space-between"
                                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                                  spacing={1.5}
                                  mb={1.5}
                                >
                                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                    <Typography variant="caption" fontWeight={800} color="primary.main" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      Live Weekly Planner Preview:
                                    </Typography>
                                    <TextField
                                      select
                                      SelectProps={{ native: true }}
                                      size="small"
                                      value={selectedPreviewWeekObj.week_number}
                                      onChange={(e) => setPreviewSyllabusWeekNum(Number(e.target.value))}
                                      sx={{ minWidth: 160 }}
                                    >
                                      {apiWeeks.map((w) => {
                                        const startDay = getApiSyllabusWeekStartDay(apiAutoPop);
                                        const spanInfo =
                                          startDay !== 'monday'
                                            ? w.week_number > 1
                                              ? ` (Starts ${DAY_LABELS[startDay]} • Prev days Wk ${w.week_number - 1})`
                                              : ` (Starts ${DAY_LABELS[startDay]})`
                                            : '';
                                        return (
                                          <option key={w.week_number} value={w.week_number}>
                                            {w.section_title}
                                            {spanInfo}
                                          </option>
                                        );
                                      })}
                                    </TextField>
                                  </Stack>

                                  {selectedPreviewWeekObj.linked_assessments.length > 0 && (
                                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                                        Linked Assessments ({DAY_LABELS[apiAutoPop.quiz_assignment_target_day]}):
                                      </Typography>
                                      {selectedPreviewWeekObj.linked_assessments.map((la) => (
                                        <Chip
                                          key={la.cmid}
                                          label={`${la.name}${la.percentage_formatted ? ` • ${la.percentage_formatted}` : ''}`}
                                          size="small"
                                          color={la.status_label === 'graded' ? 'success' : 'secondary'}
                                          variant="outlined"
                                          sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22 }}
                                        />
                                      ))}
                                    </Stack>
                                  )}
                                </Stack>

                                <Grid container spacing={1.25}>
                                  {DAY_KEYS.map((dk) => {
                                    const resolvedPreviewDay = resolveApiSyllabusWeekForWeekday(
                                      apiWeeks,
                                      selectedPreviewWeekObj.week_number,
                                      dk,
                                      apiAutoPop
                                    );
                                    const targetWeekForDay =
                                      resolvedPreviewDay.weekObj || selectedPreviewWeekObj;
                                    const previewBlock = formatApiWeekBlockForWeekday(
                                      targetWeekForDay,
                                      apiAutoPop.weekday_rules[dk],
                                      {
                                        week: targetWeekForDay.week_number,
                                        class_num: targetWeekForDay.week_number,
                                        lesson: targetWeekForDay.week_number,
                                        prev_lesson: Math.max(1, targetWeekForDay.week_number - 1),
                                      }
                                    );
                                    const previewText = [previewBlock.title, previewBlock.description]
                                      .filter(Boolean)
                                      .join('\n');
                                    const isTargetQuizDay =
                                      apiAutoPop.quiz_assignment_target_day === dk &&
                                      targetWeekForDay.linked_assessments.length > 0;
                                    return (
                                      <Grid item xs={12} sm={6} md={2.4} key={dk}>
                                        <Box
                                          sx={{
                                            p: 1.25,
                                            borderRadius: 1,
                                            bgcolor: previewText || isTargetQuizDay
                                              ? alpha(theme.palette.primary.main, 0.035)
                                              : 'background.default',
                                            border: '1px dashed',
                                            borderColor: previewText || isTargetQuizDay
                                              ? alpha(theme.palette.primary.main, 0.35)
                                              : 'divider',
                                            minHeight: 96,
                                          }}
                                        >
                                          <Stack
                                            direction="row"
                                            justifyContent="space-between"
                                            alignItems="center"
                                            mb={0.5}
                                          >
                                            <Typography
                                              variant="caption"
                                              fontWeight={800}
                                              color="text.secondary"
                                              sx={{ fontSize: '0.75rem', textTransform: 'uppercase' }}
                                            >
                                              {DAY_LABELS[dk]}
                                            </Typography>
                                            {previewText && (
                                              <Chip
                                                size="small"
                                                label={`Wk ${targetWeekForDay.week_number}`}
                                                color={
                                                  resolvedPreviewDay.isFromPreviousWeek
                                                    ? 'warning'
                                                    : 'primary'
                                                }
                                                variant="outlined"
                                                sx={{
                                                  height: 18,
                                                  fontSize: '0.65rem',
                                                  fontWeight: 700,
                                                }}
                                              />
                                            )}
                                          </Stack>
                                          {previewText ? (
                                            <FormattedParentNote
                                              title={previewBlock.title}
                                              description={previewBlock.description}
                                              color={theme.palette.text.primary}
                                              iconName="FileText"
                                              interactive={false}
                                            />
                                          ) : (
                                            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                              No schedule text
                                            </Typography>
                                          )}
                                          {isTargetQuizDay && (
                                            <Stack spacing={0.5} mt={1}>
                                              {targetWeekForDay.linked_assessments.map((la) => (
                                                <Chip
                                                  key={la.cmid}
                                                  label={`Quiz/Assn: ${la.name}`}
                                                  size="small"
                                                  color="secondary"
                                                  sx={{
                                                    height: 'auto',
                                                    py: 0.25,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    '& .MuiChip-label': { whiteSpace: 'normal' },
                                                  }}
                                                />
                                              ))}
                                            </Stack>
                                          )}
                                        </Box>
                                      </Grid>
                                    );
                                  })}
                                </Grid>
                              </Box>
                            )}
                          </Paper>

                          {/* =================================================== */}
                          {/* WEEKLY API SCHEDULE & LINKED ASSESSMENTS TABLE      */}
                          {/* =================================================== */}
                          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 640, borderRadius: 1 }}>
                            <Table stickyHeader size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 800, width: 110 }}>Week #</TableCell>
                                  <TableCell sx={{ fontWeight: 800, width: 145 }}>Section Title</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }}>Online Weekly Assignment (API Return)</TableCell>
                                  <TableCell sx={{ fontWeight: 800, width: 290 }}>Linked Quizzes &amp; Grades</TableCell>
                                  <TableCell sx={{ fontWeight: 800, width: 90 }} align="right">
                                    Actions
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {apiWeeks.map((wk) => {
                                  const effectiveText =
                                    wk.custom_override_text && wk.custom_override_text.trim().length > 0
                                      ? wk.custom_override_text
                                      : wk.raw_summary;
                                  return (
                                    <TableRow
                                      key={wk.week_number}
                                      hover
                                      selected={wk.week_number === previewSyllabusWeekNum}
                                    >
                                      <TableCell sx={{ fontWeight: 800, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                        <Stack spacing={0.5} alignItems="flex-start">
                                          <span>Week {wk.week_number}</span>
                                          {wk.custom_override_text && (
                                            <Chip
                                              label="Edited"
                                              size="small"
                                              color="warning"
                                              variant="outlined"
                                              sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }}
                                            />
                                          )}
                                        </Stack>
                                      </TableCell>
                                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', verticalAlign: 'top' }}>
                                        {wk.section_title || '—'}
                                      </TableCell>
                                      <TableCell sx={{ verticalAlign: 'top' }}>
                                        <Typography
                                          variant="body2"
                                          component="pre"
                                          sx={{
                                            whiteSpace: 'pre-wrap',
                                            fontFamily: 'inherit',
                                            fontSize: '0.75rem',
                                            lineHeight: 1.45,
                                            m: 0,
                                          }}
                                        >
                                          {effectiveText || '—'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell sx={{ verticalAlign: 'top' }}>
                                        {wk.linked_assessments.length > 0 ? (
                                          <Stack spacing={0.75}>
                                            {wk.linked_assessments.map((la) => (
                                              <Paper
                                                key={la.cmid}
                                                variant="outlined"
                                                sx={{
                                                  p: 0.85,
                                                  borderRadius: 1,
                                                  bgcolor:
                                                    la.status_label === 'graded'
                                                      ? alpha(theme.palette.success.main, 0.05)
                                                      : 'background.default',
                                                }}
                                              >
                                                <Stack
                                                  direction="row"
                                                  justifyContent="space-between"
                                                  alignItems="center"
                                                  spacing={1}
                                                >
                                                  <Typography variant="caption" fontWeight={700} sx={{ lineHeight: 1.25 }}>
                                                    {la.name}
                                                  </Typography>
                                                  {la.percentage_formatted ? (
                                                    <Chip
                                                      label={la.percentage_formatted}
                                                      size="small"
                                                      color="success"
                                                      sx={{ height: 20, fontSize: '0.75rem', fontWeight: 800 }}
                                                    />
                                                  ) : (
                                                    <Chip
                                                      label="Upcoming"
                                                      size="small"
                                                      variant="outlined"
                                                      sx={{ height: 20, fontSize: '0.75rem', fontWeight: 600 }}
                                                    />
                                                  )}
                                                </Stack>
                                                <Typography
                                                  variant="caption"
                                                  color="text.secondary"
                                                  display="block"
                                                  sx={{ fontSize: '0.75rem', mt: 0.25 }}
                                                >
                                                  {la.moodle_category}
                                                  {la.grade_raw !== null && la.grade_raw !== undefined
                                                    ? ` • Score: ${la.grade_raw}/${la.grade_max}`
                                                    : ''}
                                                  {la.weight_formatted ? ` • Wt: ${la.weight_formatted}` : ''}
                                                </Typography>
                                              </Paper>
                                            ))}
                                          </Stack>
                                        ) : (
                                          <Typography variant="caption" color="text.disabled">
                                            —
                                          </Typography>
                                        )}
                                      </TableCell>
                                      <TableCell align="right" sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setPreviewSyllabusWeekNum(wk.week_number)}
                                            sx={{ minWidth: 0, px: 0.75, fontSize: '0.75rem', fontWeight: 700 }}
                                          >
                                            Preview
                                          </Button>
                                          <IconButton
                                            size="small"
                                            color="primary"
                                            aria-label={`Edit Week ${wk.week_number}`}
                                            onClick={() => {
                                              setEditingApiWeek(wk);
                                              setEditingApiWeekText(
                                                wk.custom_override_text && wk.custom_override_text.trim().length > 0
                                                  ? wk.custom_override_text
                                                  : wk.raw_summary
                                              );
                                            }}
                                          >
                                            <Edit3 size={15} />
                                          </IconButton>
                                        </Stack>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Stack>
                      ) : courseSyl.days.length > 0 ? (
                        (() => {
                          const isClassSchedule = courseSyl.days.some((d) =>
                            Boolean(d.week_number || d.unit || d.activity)
                          );
                          const uniqueUnits = Array.from(
                            new Set(
                              courseSyl.days
                                .map((d) => d.unit?.trim())
                                .filter((u): u is string => Boolean(u))
                            )
                          );
                          const filteredClassDays =
                            scienceUnitFilter === 'all'
                              ? courseSyl.days
                              : courseSyl.days.filter((d) => d.unit === scienceUnitFilter);

                          if (isClassSchedule) {
                            return (
                              <Stack spacing={2}>
                                {uniqueUnits.length > 0 && (
                                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                                    <Typography variant="caption" fontWeight={800} color="text.secondary" mr={0.5}>
                                      FILTER BY UNIT:
                                    </Typography>
                                    <Button
                                      size="small"
                                      variant={scienceUnitFilter === 'all' ? 'contained' : 'outlined'}
                                      onClick={() => setScienceUnitFilter('all')}
                                      sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
                                    >
                                      All Units ({courseSyl.days.length} Classes)
                                    </Button>
                                    {uniqueUnits.map((unitName) => {
                                      const count = courseSyl.days.filter((d) => d.unit === unitName).length;
                                      return (
                                        <Button
                                          key={unitName}
                                          size="small"
                                          variant={scienceUnitFilter === unitName ? 'contained' : 'outlined'}
                                          onClick={() => setScienceUnitFilter(unitName)}
                                          sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
                                        >
                                          {unitName} ({count})
                                        </Button>
                                      );
                                    })}
                                  </Stack>
                                )}

                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 680, borderRadius: 1 }}>
                                  <Table stickyHeader size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 800, width: 85 }}>Week</TableCell>
                                        <TableCell sx={{ fontWeight: 800, width: 95 }}>Class</TableCell>
                                        <TableCell sx={{ fontWeight: 800, width: 155 }}>Unit</TableCell>
                                        <TableCell sx={{ fontWeight: 800 }}>Class Topic</TableCell>
                                        <TableCell sx={{ fontWeight: 800, width: 250 }}>Hands-On Activity / Lab</TableCell>
                                        <TableCell sx={{ fontWeight: 800, width: 280 }}>Supplies Needed</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {filteredClassDays.map((day) => {
                                        const wkNum = day.week_number ?? Math.ceil(day.day_number / 3);
                                        const dayOfWeekIdx = (day.day_number - 1) % 3;
                                        const weekdayShort =
                                          dayOfWeekIdx === 0 ? 'Mon' : dayOfWeekIdx === 1 ? 'Tue' : 'Wed';
                                        const daySupplies = resolveSyllabusDaySupplies(day);
                                        return (
                                          <TableRow key={day.day_number} hover>
                                            <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                                              Week {wkNum}
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>
                                              Class {day.day_number}{' '}
                                              <Typography
                                                component="span"
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ fontWeight: 600 }}
                                              >
                                                ({weekdayShort})
                                              </Typography>
                                            </TableCell>
                                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                              {day.unit ? (
                                                <Chip
                                                  label={day.unit}
                                                  size="small"
                                                  color={
                                                    day.unit === 'Chemistry'
                                                      ? 'primary'
                                                      : day.unit === 'Physics'
                                                      ? 'secondary'
                                                      : day.unit.includes('Astronomy')
                                                      ? 'info'
                                                      : 'default'
                                                  }
                                                  variant="outlined"
                                                  sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                                                />
                                              ) : (
                                                '—'
                                              )}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                              {day.topic}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.75rem' }}>
                                              {day.activity ? (
                                                <Chip
                                                  label={`Activity (${weekdayShort}): ${day.activity}`}
                                                  size="small"
                                                  color="success"
                                                  variant="outlined"
                                                  sx={{
                                                    fontWeight: 700,
                                                    fontSize: '0.75rem',
                                                    height: 'auto',
                                                    py: 0.35,
                                                    '& .MuiChip-label': {
                                                      whiteSpace: 'normal',
                                                    },
                                                  }}
                                                />
                                              ) : (
                                                <Typography variant="caption" color="text.disabled">
                                                  —
                                                </Typography>
                                              )}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.75rem' }}>
                                              {daySupplies.length > 0 ? (
                                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                  {daySupplies.map((sup, sIdx) => (
                                                    <Chip
                                                      key={`${day.day_number}-sup-${sIdx}`}
                                                      size="small"
                                                      label={sup}
                                                      sx={{
                                                        height: 20,
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        bgcolor: alpha(theme.palette.success.main, 0.1),
                                                      }}
                                                    />
                                                  ))}
                                                </Stack>
                                              ) : (
                                                <Typography variant="caption" color="text.disabled">
                                                  —
                                                </Typography>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </Stack>
                            );
                          }

                          return (
                            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 640, borderRadius: 1 }}>
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
                                      <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>#{day.day_number}</TableCell>
                                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        <Chip
                                          label={day.semester === 1 ? 'Fall' : 'Spring'}
                                          size="small"
                                          color={day.semester === 1 ? 'primary' : 'secondary'}
                                          variant="outlined"
                                          sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                                        />
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                                        {day.workbook || '—'}
                                      </TableCell>
                                      <TableCell sx={{ fontSize: '0.75rem' }}>{day.textbook || '—'}</TableCell>
                                      <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{day.topic}</TableCell>
                                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                        {day.materials || '—'}
                                      </TableCell>
                                      <TableCell sx={{ fontSize: '0.75rem' }}>{day.notes || day.fast_facts || '—'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          );
                        })()
                      ) : (
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, bgcolor: 'background.default' }}>
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
          role="dialog"
          aria-modal="true"
          aria-label={`Recurring Weekly Rules — ${recurringSubject.name}`}
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
              borderRadius: 1,
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
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: recurringSubject.color || '#1b5698',
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
                    sx={{ fontWeight: 800, fontSize: '0.75rem' }}
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
                  <IconButton
                    size="small"
                    aria-label="Close modal"
                    onClick={() => setRecurringSubject(null)}
                  >
                    <X size={18} />
                  </IconButton>
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
                  sx={{ p: 2.5, borderRadius: 1, bgcolor: 'background.default' }}
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
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
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
                                  sx={{ fontWeight: 800, height: 20, fontSize: '0.75rem' }}
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
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
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
                                  sx={{ fontWeight: 800, height: 20, fontSize: '0.75rem' }}
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
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
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
                                  sx={{ fontWeight: 800, height: 20, fontSize: '0.75rem' }}
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

                {/* 2B. DAY-BY-DAY STRUCTURED BLOCKS EDITOR */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
                  <Typography variant="subtitle1" fontWeight={800} mb={0.5}>
                    {recurringDraft.mode === 'math_syllabus'
                      ? '4. Optional Custom Day Blocks (Mon–Fri)'
                      : 'Day-by-Day Recurring Blocks & Assignments (Mon–Fri)'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    Configure structured Headers, Info bullets, Parent-Verified checks, Graded Assignments, multi-line grouped items (such as Memory Work or Novels), and weekly-shared blocks that repeat across selected weekdays.
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
                      const hasGradedOnDay = recurringDraftTemplates.some(
                        (t) =>
                          t.is_active &&
                          t.days_of_week.includes(dk) &&
                          t.linked_weekly_source !== 'syllabus_row'
                      );
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
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <span>{DAY_LABELS[dk]}</span>
                            <Chip
                              label={dCfg.enabled || hasGradedOnDay ? 'ON' : 'OFF'}
                              size="small"
                              color={dCfg.enabled || hasGradedOnDay ? 'success' : 'default'}
                              sx={{ height: 20, fontSize: '0.72rem', fontWeight: 800 }}
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

                    const allDaysTemplates: Record<DayKey, string> = {
                      monday: recurringDraft.days.monday.template,
                      tuesday: recurringDraft.days.tuesday.template,
                      wednesday: recurringDraft.days.wednesday.template,
                      thursday: recurringDraft.days.thursday.template,
                      friday: recurringDraft.days.friday.template,
                    };

                    const currentDayItems = parseRecurringTemplateDayToItems({
                      subjectId: recurringSubject.id,
                      dayKey: activeRecurringDay,
                      dayTemplate: dayCfg.template,
                      allDaysTemplates,
                      recurringTemplates: recurringDraftTemplates,
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
                              sx={{ fontWeight: 800, height: 20, fontSize: '0.75rem' }}
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
                                  Enable Recurring Schedule on {DAY_LABELS[activeRecurringDay]}
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
                                    Include &ldquo;Attend Class&rdquo; Header
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
                          <StructuredTemplateBlocksEditor
                            subjectId={recurringSubject.id}
                            dayKey={activeRecurringDay}
                            subjectColor={recurringSubject.color || theme.palette.primary.main}
                            items={currentDayItems}
                            onChangeItems={(nextItems) =>
                              handleUpdateRecurringDayItems(activeRecurringDay, nextItems)
                            }
                            rawTextValue={dayCfg.template}
                            onChangeRawText={(nextRaw) => updateDay({ template: nextRaw })}
                            assignmentTypes={assignmentTypes}
                            allowGradedBlocks={true}
                            allowRepeatAcrossWeek={true}
                            showVariableTokens={true}
                          />
                        )}
                      </Stack>
                    );
                  })()}
                </Paper>

                {/* 3. LIVE 5-DAY WEEK PREVIEW */}
                {livePreviewNotes && livePreviewCounters && (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2.5, borderRadius: 1, bgcolor: 'background.default' }}
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
                        const dayAssigns = livePreviewAssignmentsByDay?.[dk] || [];
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
                                borderRadius: 1,
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
                                  color={theme.palette.text.primary}
                                  iconName="FileText"
                                  interactive={false}
                                  excludeAssignmentTitles={dayAssigns.map(
                                    (a) => a.title
                                  )}
                                />
                              ) : dayAssigns.length === 0 ? (
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                  fontStyle="italic"
                                >
                                  (Blank)
                                </Typography>
                              ) : null}

                              {dayAssigns.length > 0 && (
                                <Stack spacing={0.75} sx={{ mt: hasNoteContent ? 1 : 0 }}>
                                  {dayAssigns.map((assign, aIdx) => (
                                    <Box
                                      key={`${assign.title}-${aIdx}`}
                                      sx={{
                                        p: 0.75,
                                        borderRadius: 1,
                                        bgcolor: alpha(theme.palette.warning.main, 0.08),
                                        border: `1px solid ${alpha(
                                          theme.palette.warning.main,
                                          0.35
                                        )}`,
                                      }}
                                    >
                                      <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        spacing={0.5}
                                      >
                                        <Typography
                                          variant="caption"
                                          fontWeight={700}
                                          sx={{ fontSize: '0.73rem', lineHeight: 1.25 }}
                                        >
                                          {assign.title}
                                        </Typography>
                                        <Chip
                                          size="small"
                                          label={
                                            assign.grading_mode === 'problems_calculator'
                                              ? `${assign.total_problems || 20} probs`
                                              : `${assign.points_possible} pts`
                                          }
                                          color="warning"
                                          sx={{
                                            height: 17,
                                            fontSize: '0.62rem',
                                            fontWeight: 800,
                                          }}
                                        />
                                      </Stack>
                                    </Box>
                                  ))}
                                </Stack>
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
          role="dialog"
          aria-modal="true"
          aria-label="Edit Math Syllabus Day"
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
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              px={3}
              py={2}
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6" fontWeight={800}>
                {isNewSyllabusDay
                  ? 'Add New Syllabus Day'
                  : `Edit Math Syllabus — Day ${editingSyllabusDay.day_number} (Semester ${editingSyllabusDay.semester === 1 ? '5A' : '5B'})`}
              </Typography>
              <IconButton
                size="small"
                aria-label="Close modal"
                onClick={() => {
                  setEditingSyllabusDay(null);
                  setIsNewSyllabusDay(false);
                }}
              >
                <X size={18} />
              </IconButton>
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
          role="dialog"
          aria-modal="true"
          aria-label="Upload Syllabus & AI Automation Builder"
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
              borderRadius: 1,
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
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
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
                          borderRadius: 1,
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
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
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
                                sx={{ fontWeight: 800, fontSize: '0.75rem' }}
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
                          sx={{ p: 2, borderRadius: 1, bgcolor: 'background.default' }}
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
                                      borderRadius: 1,
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
                                        sx={{ height: 18, fontSize: '0.75rem', fontWeight: 800 }}
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
                                      sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}
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
                              sx={{ maxHeight: 220, borderRadius: 1 }}
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
                                      <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Day {sd.day_number}</TableCell>
                                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Sem {sd.semester}</TableCell>
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
                        borderRadius: 1,
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

      {/* ===================================================================== */}
      {/* API PORTAL INTEGRATION & COURSE MATCHER MODAL                         */}
      {/* ===================================================================== */}
      {apiModalOpen && (
        <Box
          role="dialog"
          aria-modal="true"
          aria-label="Online Portal API Integration — Memoria Academy"
          onClick={() => {
            if (!discoveringCourses && !syncingPortal) setApiModalOpen(false);
          }}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1450,
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
              maxWidth: 940,
              maxHeight: '90vh',
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <Box
              px={3}
              py={2}
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CloudDownload size={22} color={theme.palette.secondary.main} />
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    Online Portal API Integration — Memoria Academy
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Update student portal login credentials, fetch online courses, and match each API course to a subject in your planner.
                  </Typography>
                </Box>
              </Stack>
              <IconButton
                size="small"
                aria-label="Close modal"
                disabled={discoveringCourses || syncingPortal}
                onClick={() => setApiModalOpen(false)}
              >
                <X size={20} />
              </IconButton>
            </Box>

            {/* Body */}
            <Box sx={{ p: 3, overflowY: 'auto', flexGrow: 1 }}>
              <Stack spacing={3}>
                {/* 1. Credentials Card */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                    mb={2}
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800}>
                        1. Student Portal Login &amp; Endpoints
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Authenticates directly with Memoria Academy&apos;s student portal API (`mpoa.memoriapress.com`) to pull weekly schedules, quizzes, and grades.
                      </Typography>
                    </Box>
                    {apiLastSyncedAt && (
                      <Chip
                        label={`Last Synced: ${new Date(apiLastSyncedAt).toLocaleString()}`}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                      />
                    )}
                  </Stack>

                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Account Login Page URL"
                        value={portalLoginUrl}
                        onChange={(e) => setPortalLoginUrl(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Student Portal API Base URL (Moodle)"
                        value={moodleBaseUrl}
                        onChange={(e) => setMoodleBaseUrl(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Portal Username"
                        value={apiUsername}
                        onChange={(e) => setApiUsername(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        type={showApiPassword ? 'text' : 'password'}
                        label="Portal Password"
                        value={apiPassword}
                        onChange={(e) => setApiPassword(e.target.value)}
                        InputProps={{
                          endAdornment: (
                            <Button
                              size="small"
                              onClick={() => setShowApiPassword((prev) => !prev)}
                              sx={{ minWidth: 0, px: 1, fontSize: '0.75rem', fontWeight: 700 }}
                            >
                              {showApiPassword ? 'Hide' : 'Show'}
                            </Button>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Button
                        fullWidth
                        variant="outlined"
                        color="primary"
                        startIcon={
                          discoveringCourses ? <CircularProgress size={14} /> : <RefreshCw size={15} />
                        }
                        disabled={discoveringCourses || syncingPortal}
                        onClick={handleDiscoverPortalCourses}
                        sx={{ fontWeight: 700, textTransform: 'none', py: 0.9 }}
                      >
                        {discoveringCourses ? 'Fetching...' : 'Fetch API Courses'}
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>

                {/* 2. Course Matcher Table */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1}
                    mb={2}
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800}>
                        2. Match Returned API Courses to Subjects
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Matched courses will display their official course name in italics underneath the subject name in the Weekly Planner and sync their 34-week syllabus &amp; grades.
                      </Typography>
                    </Box>
                    {apiStudentName && (
                      <Chip
                        label={`Student: ${apiStudentName}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                  </Stack>

                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Official API Course Name</TableCell>
                          <TableCell sx={{ fontWeight: 800, width: 150 }}>Course Code</TableCell>
                          <TableCell sx={{ fontWeight: 800, width: 290 }}>Matched Planner Subject</TableCell>
                          <TableCell sx={{ fontWeight: 800, width: 130 }} align="center">
                            Sync Status
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {apiCourseMappings.map((mapping) => {
                          const isIgnored = mapping.ignored || !mapping.subject_id;
                          return (
                            <TableRow key={mapping.moodle_course_id} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight={700}>
                                  {mapping.course_fullname}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ fontStyle: 'italic' }}
                                >
                                  Moodle ID #{mapping.moodle_course_id}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Chip
                                  label={mapping.course_shortname}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  select
                                  SelectProps={{ native: true }}
                                  fullWidth
                                  size="small"
                                  value={isIgnored ? '__ignore__' : mapping.subject_id || '__ignore__'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setApiCourseMappings((prev) =>
                                      prev.map((m) =>
                                        m.moodle_course_id === mapping.moodle_course_id
                                          ? {
                                              ...m,
                                              subject_id: val === '__ignore__' ? null : val,
                                              ignored: val === '__ignore__',
                                            }
                                          : m
                                      )
                                    );
                                  }}
                                >
                                  <option value="__ignore__">
                                    — Ignored / Unmapped (Do Not Sync) —
                                  </option>
                                  {subjects.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </TextField>
                              </TableCell>
                              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                                {isIgnored ? (
                                  <Chip
                                    label="Ignored"
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontWeight: 700, fontSize: '0.75rem', opacity: 0.7 }}
                                  />
                                ) : (
                                  <Chip
                                    icon={<CheckCircle2 size={12} />}
                                    label="Active Sync"
                                    size="small"
                                    color="success"
                                    sx={{ fontWeight: 800, fontSize: '0.75rem' }}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Stack>
            </Box>

            {/* Footer */}
            <Box
              px={3}
              py={2}
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Syncing pulls all 34 weeks of schedules, quizzes, teacher feedback, and Moodle gradebook weights.
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <Button
                  color="inherit"
                  disabled={discoveringCourses || syncingPortal}
                  onClick={() => setApiModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={
                    syncingPortal ? <CircularProgress size={15} color="inherit" /> : <CloudDownload size={16} />
                  }
                  disabled={discoveringCourses || syncingPortal}
                  onClick={() => handleSyncPortalCourses(true)}
                  sx={{ fontWeight: 700 }}
                >
                  {syncingPortal
                    ? 'Syncing Syllabi & Grades...'
                    : 'Save Mapping & Sync Syllabi + Grades'}
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Box>
      )}

      {/* ===================================================================== */}
      {/* EDIT API WEEK SCHEDULE OVERRIDE MODAL                                 */}
      {/* ===================================================================== */}
      {editingApiWeek && (
        <Box
          role="dialog"
          aria-modal="true"
          aria-label={`Customize ${editingApiWeek.section_title} Schedule Text`}
          onClick={() => {
            if (!savingApiWeekText) setEditingApiWeek(null);
          }}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1460,
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
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              px={3}
              py={2}
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  Customize {editingApiWeek.section_title} Schedule Blocks
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Configure structured Headers, Info bullets, Verified checklist items, and grouped sub-lines. Edits are preserved across future API syncs.
                </Typography>
              </Box>
              <IconButton size="small" aria-label="Close modal" onClick={() => setEditingApiWeek(null)}>
                <X size={18} />
              </IconButton>
            </Box>

            <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={7.5}>
                  <Stack spacing={1.5}>
                    {(() => {
                      const activeSub = subjects.find((s) => s.id === activeSyllabusSubTab);
                      const parsedWeekItems = parseRecurringTemplateDayToItems({
                        subjectId: activeSub?.id || 'api-week',
                        dayKey: 'monday',
                        dayTemplate: editingApiWeekText,
                      });
                      return (
                        <StructuredTemplateBlocksEditor
                          subjectId={activeSub?.id || 'api-week'}
                          dayKey="monday"
                          subjectColor={activeSub?.color || theme.palette.primary.main}
                          items={parsedWeekItems}
                          onChangeItems={(nextItems) => {
                            const serialized = serializeItemsToRecurringTemplateText(nextItems, {
                              includeSingleDayGradedInText: true,
                            });
                            setEditingApiWeekText(serialized);
                          }}
                          rawTextValue={editingApiWeekText}
                          onChangeRawText={(nextRaw) => setEditingApiWeekText(nextRaw)}
                          assignmentTypes={assignmentTypes}
                          allowGradedBlocks={false}
                          allowRepeatAcrossWeek={true}
                          showVariableTokens={false}
                        />
                      );
                    })()}
                    {editingApiWeek.raw_summary && editingApiWeekText !== editingApiWeek.raw_summary && (
                      <Button
                        size="small"
                        variant="text"
                        color="secondary"
                        onClick={() => setEditingApiWeekText(editingApiWeek.raw_summary)}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                      >
                        Reset to Original API Text
                      </Button>
                    )}
                  </Stack>
                </Grid>

                <Grid item xs={12} md={4.5}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: 'background.default',
                      position: 'sticky',
                      top: 0,
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={800}
                      color="primary.main"
                      display="block"
                      mb={1}
                      sx={{
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        pb: 0.5,
                      }}
                    >
                      Live Binder Preview — {editingApiWeek.section_title}
                    </Typography>
                    {editingApiWeekText.trim() ? (
                      <FormattedParentNote
                        title={null}
                        description={editingApiWeekText}
                        color={theme.palette.text.primary}
                        iconName="FileText"
                        interactive={false}
                      />
                    ) : (
                      <Typography variant="caption" color="text.disabled" fontStyle="italic">
                        No schedule blocks entered
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              </Grid>
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
                color="inherit"
                disabled={savingApiWeekText}
                onClick={() => setEditingApiWeek(null)}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                disabled={savingApiWeekText}
                onClick={() => {
                  void handleSaveApiWeekOverrideText();
                }}
                sx={{ fontWeight: 700 }}
              >
                {savingApiWeekText ? 'Saving...' : 'Save Week Schedule'}
              </Button>
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
        <Stack spacing={2.5}>
          <Skeleton variant="rounded" height={88} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rounded" height={520} sx={{ borderRadius: 1 }} />
        </Stack>
      }
    >
      <AutomationsContent />
    </Suspense>
  );
}
