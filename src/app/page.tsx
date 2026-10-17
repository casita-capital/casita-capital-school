'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  GraduationCap,
  LogIn,
  Package,
  Plus,
  Printer,
  Sparkles,
} from 'lucide-react';
import { RouterLink } from 'src/components/base/router-link';
import { UnifiedAssignmentModal } from 'src/components/assignments/unified-assignment-modal';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { createClient } from 'src/services/supabase/client';
import {
  AssignmentTypeConfig,
  calculateSubjectGradeSummary,
  DEFAULT_ASSIGNMENT_TYPES,
  formatClassGradeDisplay,
  GradebookAssignment,
  isSubjectApiSynced,
  parseAssignmentMoodleMeta,
  parseSubjectGradingPolicy,
  SubjectTermOverride,
  SubjectWithGrading,
} from 'src/utils/gradebook-calculator';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  getActiveCourseSyllabus,
  getOfficialCourseSubtitle,
  parseRecurringConfig,
  resolveSubjectCountersForWeek,
  resolveSyllabusDaySupplies,
} from 'src/utils/recurring-planner';

interface UserProfile {
  full_name: string;
  email: string;
  role: string;
}

interface InstructionalHourRow {
  id: string;
  subject_id: string;
  minutes: number;
}

interface ExternalWeekItem {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  courseSubtitle: string | null;
  providerName: string;
  categoryLabel: string;
  weekNumber: number | null;
  classNumber?: number | null;
  classTopic?: string | null;
  weekdayLabel?: string | null;
  supplies?: string[];
  openDate: string | null;
  dueDate: string;
  isScored: boolean;
  scoreDisplay: string | null;
  statusLabel: 'Graded' | 'Submitted' | 'Due This Week' | 'Open';
  assignmentRecord?: GradebookAssignment;
}

function formatIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getCurrentWeekBounds(): {
  todayStr: string;
  mondayStr: string;
  fridayStr: string;
  sundayStr: string;
  weekRangeLabel: string;
} {
  const now = new Date();
  const todayStr = formatIsoDate(now);
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMonday);

  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);

  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const monMonth = mon.toLocaleDateString('en-US', { month: 'short' });
  const friMonth = fri.toLocaleDateString('en-US', { month: 'short' });
  const weekRangeLabel =
    mon.getMonth() === fri.getMonth()
      ? `${monMonth} ${mon.getDate()}–${fri.getDate()}, ${fri.getFullYear()}`
      : `${monMonth} ${mon.getDate()} – ${friMonth} ${fri.getDate()}, ${fri.getFullYear()}`;

  return {
    todayStr,
    mondayStr: formatIsoDate(mon),
    fridayStr: formatIsoDate(fri),
    sundayStr: formatIsoDate(sun),
    weekRangeLabel,
  };
}

export default function SchoolDashboardPage() {
  const theme = useTheme();
  const { schoolName } = useSchoolSettings();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithGrading[]>([]);
  const [assignments, setAssignments] = useState<GradebookAssignment[]>([]);
  const [assignmentTypes, setAssignmentTypes] =
    useState<AssignmentTypeConfig[]>(DEFAULT_ASSIGNMENT_TYPES);
  const [termOverrides, setTermOverrides] = useState<SubjectTermOverride[]>([]);
  const [instructionalHours, setInstructionalHours] = useState<InstructionalHourRow[]>([]);

  const [editingAssignment, setEditingAssignment] = useState<GradebookAssignment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { todayStr, mondayStr, sundayStr, weekRangeLabel } = useMemo(
    () => getCurrentWeekBounds(),
    []
  );

  const loadDashboardData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const activeEmail =
        user?.email ||
        (typeof window !== 'undefined' ? localStorage.getItem('school_active_user_email') : null) ||
        'blake.womble@gmail.com';

      let targetRecord: UserProfile | null = null;

      if (user?.id) {
        const { data: byAuthId } = await supabase
          .from('users')
          .select('full_name, email, role')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (byAuthId) targetRecord = byAuthId as UserProfile;
      }

      if (!targetRecord && activeEmail) {
        const { data: byEmail } = await supabase
          .from('users')
          .select('full_name, email, role')
          .eq('email', activeEmail)
          .maybeSingle();

        if (byEmail) targetRecord = byEmail as UserProfile;
      }

      if (!targetRecord) {
        const { data: fallbackUser } = await supabase
          .from('users')
          .select('full_name, email, role')
          .eq('email', 'blake.womble@gmail.com')
          .maybeSingle();

        if (fallbackUser) targetRecord = fallbackUser as UserProfile;
      }

      setProfile(
        targetRecord || {
          full_name: 'Blake Womble',
          email: 'blake.womble@gmail.com',
          role: 'admin',
        }
      );

      const [subRes, assignRes, typeRes, ovRes, hrRes] = await Promise.all([
        supabase.from('subjects').select('*').order('sort_order', { ascending: true }),
        supabase.from('assignments').select('*').order('due_date', { ascending: true }),
        supabase.from('assignment_types').select('*').order('sort_order', { ascending: true }),
        supabase.from('subject_term_overrides').select('*'),
        supabase.from('instructional_hours').select('id, subject_id, minutes'),
      ]);

      if (subRes.data) {
        setSubjects(subRes.data as unknown as SubjectWithGrading[]);
      }
      if (assignRes.data) {
        setAssignments(assignRes.data as unknown as GradebookAssignment[]);
      }
      if (typeRes.data && typeRes.data.length > 0) {
        setAssignmentTypes(typeRes.data as unknown as AssignmentTypeConfig[]);
      }
      if (ovRes.data) {
        setTermOverrides(ovRes.data as unknown as SubjectTermOverride[]);
      }
      if (hrRes.data) {
        setInstructionalHours(hrRes.data as unknown as InstructionalHourRow[]);
      }
    } catch {
      setProfile({
        full_name: 'Blake Womble',
        email: 'blake.womble@gmail.com',
        role: 'admin',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const subjectMap = useMemo(() => {
    const map = new Map<string, SubjectWithGrading>();
    for (const s of subjects) map.set(s.id, s);
    return map;
  }, [subjects]);

  const typeMap = useMemo(() => {
    const map = new Map<string, AssignmentTypeConfig>();
    for (const t of assignmentTypes) map.set(t.slug, t);
    return map;
  }, [assignmentTypes]);

  // 1. Left Column: Past-Due Assignments Without Grades Entered
  const pastDueUngradedAssignments = useMemo(() => {
    return assignments
      .filter((a) => {
        if (a.workflow_status === 'staged' || a.workflow_status === 'ignored') return false;
        if (a.is_graded === false || a.is_exempt) return false;
        if (!a.due_date || a.due_date >= todayStr) return false;

        const mm = parseAssignmentMoodleMeta(a.state_standards);
        if (mm?.is_ungraded_bucket) return false;

        const hasScore =
          typeof a.points_earned === 'number' ||
          typeof a.percentage_score === 'number' ||
          (a.grading_mode === 'problems_calculator' &&
            typeof a.total_problems === 'number' &&
            typeof a.missed_problems === 'number');

        return !hasScore;
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [assignments, todayStr]);

  // 2. Right Column: Class Grade Summaries across all subjects
  const subjectSummaries = useMemo(() => {
    return subjects.map((sub) => {
      const override = termOverrides.find(
        (ov) =>
          ov.subject_id === sub.id &&
          ov.term_name === 'Full Year 2026-2027' &&
          ov.academic_year === '2026-2027'
      );
      const loggedMinutes = instructionalHours
        .filter((h) => h.subject_id === sub.id)
        .reduce((acc, h) => acc + h.minutes, 0);

      return calculateSubjectGradeSummary({
        subject: sub,
        assignments,
        assignmentTypes,
        override,
        loggedMinutes,
      });
    });
  }, [subjects, assignments, assignmentTypes, termOverrides, instructionalHours]);

  const overallGpa = useMemo(() => {
    let gradedCredits = 0;
    let unweightedSum = 0;
    for (const sum of subjectSummaries) {
      if (sum.effective_percentage !== null || sum.is_overridden) {
        gradedCredits += sum.effective_credits;
        unweightedSum += sum.gpa_unweighted * sum.effective_credits;
      }
    }
    return gradedCredits > 0 ? Number((unweightedSum / gradedCredits).toFixed(2)) : null;
  }, [subjectSummaries]);

  // 3. Bottom Section: External Assignments & Syllabus Activities Scheduled for This Week
  const externalThisWeekItems = useMemo(() => {
    const items: ExternalWeekItem[] = [];
    const seenKeys = new Set<string>();

    const addDaysToIso = (baseIso: string, offsetDays: number): string => {
      const d = new Date(`${baseIso}T00:00:00`);
      d.setDate(d.getDate() + offsetDays);
      return formatIsoDate(d);
    };

    const getWeekdayLabelFromDate = (dateStr: string): string | null => {
      const d = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-US', { weekday: 'long' });
    };

    for (const sub of subjects) {
      const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
      const activeSyl = getActiveCourseSyllabus(cfg);
      const hasSyllabusActivities = Boolean(
        activeSyl?.days?.some((d) => Boolean(d.activity))
      );
      const isExternal =
        cfg.instructor_info?.provider_type === 'external' ||
        isSubjectApiSynced(sub) ||
        cfg.course_syllabus?.source_type === 'api_sync';

      const subAssignments = assignments.filter(
        (a) =>
          a.subject_id === sub.id &&
          a.workflow_status !== 'staged' &&
          a.workflow_status !== 'ignored'
      );
      const hasActivityAssignments = subAssignments.some(
        (a) => a.category === 'activity'
      );

      if (!isExternal && !hasSyllabusActivities && !hasActivityAssignments) continue;

      const policy = parseSubjectGradingPolicy(sub);
      const counters = resolveSubjectCountersForWeek(cfg, mondayStr, undefined);
      const currentWeekNum = counters.week_num;
      const courseSubtitle = getOfficialCourseSubtitle(cfg);
      const providerName =
        cfg.instructor_info?.outside_entity_name ||
        (isSubjectApiSynced(sub)
          ? 'Memoria Academy'
          : sub.name.toLowerCase().includes('science')
          ? 'Science Shepherd'
          : cfg.instructor_info?.teacher_name || 'Syllabus Activity');

      // Map each weekday to its scheduled class day for class-based syllabi
      const classDayByNumber = new Map<
        number,
        { dayKey: DayKey; dueDate: string; weekdayLabel: string }
      >();
      if (cfg.mode === 'template' && activeSyl?.days?.length) {
        let runningCls = counters.class_num;
        DAY_KEYS.forEach((dk, idx) => {
          const dayCfg = cfg.days[dk];
          if (dayCfg?.enabled && dayCfg.template.includes('{class_num}')) {
            classDayByNumber.set(runningCls, {
              dayKey: dk,
              dueDate: addDaysToIso(mondayStr, idx),
              weekdayLabel: DAY_LABELS[dk],
            });
            runningCls += 1;
          }
        });
      }

      for (const a of subAssignments) {
        const isActivityItem = a.category === 'activity';
        if (!isExternal && !isActivityItem) continue;

        const mm = parseAssignmentMoodleMeta(a.state_standards);
        const dueInWeek = a.due_date >= mondayStr && a.due_date <= sundayStr;
        const matchedSyllabusWeek =
          typeof mm?.week_number === 'number' && mm.week_number === currentWeekNum;

        if (!dueInWeek && !matchedSyllabusWeek) continue;

        const key = `${sub.id}::${a.title.toLowerCase()}::${a.due_date}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const typeInfo = typeMap.get(a.category);
        const hasScore =
          typeof a.percentage_score === 'number' || typeof a.points_earned === 'number';
        const scoreDisplay =
          typeof a.percentage_score === 'number'
            ? formatClassGradeDisplay(a.percentage_score, a.letter_grade || '', policy)
            : typeof a.points_earned === 'number'
            ? `${a.points_earned}/${a.points_possible ?? 100}`
            : null;

        const statusLabel: ExternalWeekItem['statusLabel'] = hasScore
          ? 'Graded'
          : a.workflow_status === 'submitted'
          ? 'Submitted'
          : dueInWeek
          ? 'Due This Week'
          : 'Open';

        const resolvedClassNum =
          mm?.class_number ??
          (isActivityItem ? a.syllabus_day_number : null) ??
          null;
        const matchedSylDay =
          resolvedClassNum !== null
            ? activeSyl?.days.find((d) => d.day_number === resolvedClassNum)
            : activeSyl?.days.find(
                (d) =>
                  d.activity &&
                  a.title.toLowerCase().includes(d.activity.toLowerCase())
              );

        const supplies =
          mm?.supplies && mm.supplies.length > 0
            ? mm.supplies
            : matchedSylDay
            ? resolveSyllabusDaySupplies(matchedSylDay)
            : [];

        items.push({
          id: a.id,
          title: a.title,
          subjectId: sub.id,
          subjectName: sub.name,
          subjectColor: sub.color,
          courseSubtitle,
          providerName,
          categoryLabel:
            isActivityItem
              ? 'Activity'
              : mm?.moodle_category || typeInfo?.name || a.category,
          weekNumber:
            mm?.week_number ??
            matchedSylDay?.week_number ??
            (isActivityItem ? currentWeekNum : a.syllabus_day_number ?? currentWeekNum),
          classNumber: resolvedClassNum ?? matchedSylDay?.day_number ?? null,
          classTopic: mm?.class_topic ?? matchedSylDay?.topic ?? null,
          weekdayLabel:
            (mm?.weekday ? DAY_LABELS[mm.weekday] : null) ||
            getWeekdayLabelFromDate(a.due_date),
          supplies: supplies.length > 0 ? supplies : undefined,
          openDate: a.assigned_date || mm?.official_portal_open_date || null,
          dueDate: a.due_date,
          isScored: hasScore,
          scoreDisplay,
          statusLabel,
          assignmentRecord: a,
        });
      }

      // Also include any syllabus Activities scheduled on this week's classes (placed on the SAME weekday as their class)
      if (hasSyllabusActivities && activeSyl?.days) {
        for (const [clsNum, schedInfo] of classDayByNumber.entries()) {
          const sylDay = activeSyl.days.find((d) => d.day_number === clsNum);
          if (!sylDay || !sylDay.activity) continue;

          const actTitle = `Activity: ${sylDay.activity}`;
          const key = `${sub.id}::${actTitle.toLowerCase()}::${schedInfo.dueDate}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const supplies = resolveSyllabusDaySupplies(sylDay);
          items.push({
            id: `syl-act-${sub.id}-${sylDay.day_number}`,
            title: actTitle,
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color,
            courseSubtitle,
            providerName,
            categoryLabel: 'Activity',
            weekNumber: sylDay.week_number ?? currentWeekNum,
            classNumber: sylDay.day_number,
            classTopic: sylDay.topic,
            weekdayLabel: schedInfo.weekdayLabel,
            supplies: supplies.length > 0 ? supplies : undefined,
            openDate: mondayStr,
            dueDate: schedInfo.dueDate,
            isScored: false,
            scoreDisplay: null,
            statusLabel: 'Due This Week',
          });
        }
      }

      // Also check API syllabus weeks for any linked assessments on currentWeekNum not yet in assignments
      const matchedApiWeek = cfg.course_syllabus?.weeks?.find(
        (w) => w.week_number === currentWeekNum
      );
      if (matchedApiWeek && matchedApiWeek.linked_assessments.length > 0) {
        for (const assess of matchedApiWeek.linked_assessments) {
          const cleanTitle = assess.name
            .replace(/--DUE[\s\S]*$/i, '')
            .replace(/^LC 4th Edition\s+/i, '')
            .trim();
          const key = `${sub.id}::${cleanTitle.toLowerCase()}::${assess.due_date || mondayStr}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const hasScore =
            typeof assess.grade_raw === 'number' && !Number.isNaN(assess.grade_raw);
          const pct =
            hasScore && assess.grade_max > 0 && assess.grade_raw !== null
              ? Number(((assess.grade_raw / assess.grade_max) * 100).toFixed(1))
              : null;

          items.push({
            id: `api-${sub.id}-${assess.cmid}`,
            title: cleanTitle,
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color,
            courseSubtitle,
            providerName,
            categoryLabel: assess.moodle_category || 'Quiz / Assessment',
            weekNumber: matchedApiWeek.week_number,
            openDate: assess.open_date,
            dueDate: assess.due_date || mondayStr,
            isScored: hasScore,
            scoreDisplay: pct !== null ? `${pct}%` : null,
            statusLabel: hasScore ? 'Graded' : 'Due This Week',
          });
        }
      }
    }

    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [subjects, assignments, mondayStr, sundayStr, typeMap]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : '';

  return (
    <Box>
      {/* Clean Unified Greeting Header */}
      <Card
        elevation={0}
        sx={{
          p: 2.5,
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
                fontSize: { xs: '1.4rem', sm: '1.7rem' },
                lineHeight: 1.15,
              }}
            >
              {firstName ? `Welcome back, ${firstName}` : schoolName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {schoolName} · Weekly binder planning, gradebook overview, and external course schedule.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {profile ? (
              <>
                <Button
                  component={RouterLink}
                  href="/calendar"
                  variant="outlined"
                  size="small"
                  startIcon={<Plus size={16} />}
                  sx={{
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 1.75,
                    py: 0.85,
                    borderColor: 'divider',
                    color: 'text.primary',
                  }}
                >
                  New Calendar Event
                </Button>
                <Button
                  component={RouterLink}
                  href="/calendar/planner"
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<Printer size={16} />}
                  sx={{
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 2,
                    py: 0.85,
                    boxShadow: 'none',
                  }}
                >
                  Open Weekly Binder
                </Button>
              </>
            ) : (
              <Button
                component={RouterLink}
                href="/login"
                variant="contained"
                color="primary"
                startIcon={<LogIn size={18} />}
                sx={{ fontWeight: 600, textTransform: 'none' }}
              >
                Sign In to Start
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>

      {/* Top Row: Weekly Binder Planner + Assignments & Tasks */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Weekly Binder Planner Card */}
        <Grid item xs={12} md={6}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.35),
              bgcolor: alpha(theme.palette.primary.main, 0.02),
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: 'primary.main',
                    color: '#ffffff',
                    display: 'flex',
                  }}
                >
                  <Printer size={20} />
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  Weekly Binder Planner
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
                Print-ready 2-page weekly binder spread with subject rows, top 3 daily priorities, habits tracker, and auto-populated recurring assignments.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/calendar/planner"
                  variant="contained"
                  color="primary"
                  fullWidth
                  endIcon={<ArrowRight size={16} />}
                  sx={{
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                    py: 1,
                    boxShadow: 'none',
                  }}
                >
                  Open Weekly Binder
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Assignments & Tasks Card */}
        <Grid item xs={12} md={6}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.12),
                    color: 'success.main',
                    display: 'flex',
                  }}
                >
                  <FileText size={20} />
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  Assignments &amp; Tasks
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
                Organize homework, projects, tests, and family to-do tasks scoped by subject and due date.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/assignments"
                  variant="outlined"
                  color="inherit"
                  fullWidth
                  endIcon={<ArrowRight size={16} />}
                  sx={{
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                    py: 1,
                    borderColor: 'divider',
                  }}
                >
                  Open Assignments
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Two-Column Middle Section: Past-Due Needs Grading (Left) & Class Grade Summary (Right) */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Left Column: Past-Due Assignments Needing Grades */}
        <Grid item xs={12} lg={6}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                p: 2.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    p: 0.85,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.warning.main, 0.14),
                    color: 'warning.main',
                    display: 'flex',
                  }}
                >
                  <AlertCircle size={18} />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={700}>
                      Past-Due Assignments Needing Grades
                    </Typography>
                    <Chip
                      size="small"
                      label={pastDueUngradedAssignments.length}
                      color={pastDueUngradedAssignments.length > 0 ? 'warning' : 'success'}
                      sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700 }}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Assignments with a due date before {todayStr} that do not have a score entered yet
                  </Typography>
                </Box>
              </Stack>

              <Button
                component={RouterLink}
                href="/gradebook?tab=assignments"
                size="small"
                sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
              >
                Gradebook →
              </Button>
            </Box>

            <TableContainer sx={{ maxHeight: 380, flex: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                      ASSIGNMENT
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                      CLASS
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                      DUE DATE
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}
                    >
                      ACTION
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pastDueUngradedAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                        <Stack spacing={0.75} alignItems="center">
                          <CheckCircle2 size={24} color={theme.palette.success.main} />
                          <Typography variant="body2" fontWeight={600}>
                            All past-due assignments are graded!
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            No overdue items are waiting for grade entry.
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pastDueUngradedAssignments.map((a) => {
                      const sub = a.subject_id ? subjectMap.get(a.subject_id) : undefined;
                      const typeInfo = typeMap.get(a.category);
                      return (
                        <TableRow key={a.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {a.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {typeInfo?.name || a.category}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {sub ? (
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: sub.color,
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography variant="caption" fontWeight={600}>
                                  {sub.name}
                                </Typography>
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color="error.main"
                              sx={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {a.due_date}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              startIcon={<Edit3 size={13} />}
                              onClick={() => {
                                setEditingAssignment(a);
                                setModalOpen(true);
                              }}
                              sx={{
                                fontWeight: 600,
                                textTransform: 'none',
                                py: 0.25,
                                px: 1,
                                fontSize: '0.75rem',
                              }}
                            >
                              Enter Grade
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Right Column: Basic Summary of All Class Grades */}
        <Grid item xs={12} lg={6}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                p: 2.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    p: 0.85,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.main',
                    display: 'flex',
                  }}
                >
                  <GraduationCap size={18} />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={700}>
                      Class Grades Summary
                    </Typography>
                    {overallGpa !== null && (
                      <Chip
                        size="small"
                        icon={<Award size={13} />}
                        label={`${overallGpa.toFixed(2)} GPA`}
                        color="primary"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700 }}
                      />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Current standing across all subjects for 2026–2027
                  </Typography>
                </Box>
              </Stack>

              <Button
                component={RouterLink}
                href="/gradebook"
                size="small"
                sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
              >
                Full Gradebook →
              </Button>
            </Box>

            <TableContainer sx={{ maxHeight: 380, flex: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                      SUBJECT / CLASS
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                      PROVIDER
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}
                    >
                      GRADED ITEMS
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}
                    >
                      CURRENT GRADE
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subjectSummaries.map((sum) => {
                    const sub = subjectMap.get(sum.subject_id);
                    const cfg = sub ? parseRecurringConfig(sub.recurring_config, sub.name) : null;
                    const officialCourse = cfg ? getOfficialCourseSubtitle(cfg) : null;
                    const isExternal = cfg?.instructor_info?.provider_type === 'external';
                    const providerLabel = isExternal
                      ? cfg?.instructor_info?.outside_entity_name || 'External'
                      : cfg?.instructor_info?.teacher_name || 'Internal (Mom)';

                    return (
                      <TableRow key={sum.subject_id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                bgcolor: sub?.color || 'primary.main',
                                flexShrink: 0,
                              }}
                            />
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {sum.subject_name}
                              </Typography>
                              {officialCourse && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ fontStyle: 'italic', display: 'block', lineHeight: 1.2 }}
                                >
                                  {officialCourse}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" fontWeight={500}>
                            {providerLabel}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                          >
                            {sum.graded_count} / {sum.total_assignments}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {sum.effective_percentage !== null || sum.is_overridden ? (
                            <Chip
                              size="small"
                              label={sum.formatted_display}
                              color={
                                (sum.effective_percentage ?? 100) >= 90
                                  ? 'success'
                                  : (sum.effective_percentage ?? 100) >= 80
                                  ? 'primary'
                                  : 'warning'
                              }
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              No Grades Yet
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Full-Width Section: External Assignments & Activities Scheduled for This Week */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            p: 2.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                p: 0.85,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.info.main, 0.12),
                color: 'info.main',
                display: 'flex',
              }}
            >
              <ExternalLink size={18} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="subtitle1" fontWeight={700}>
                  External Course Assignments &amp; Activities Scheduled This Week
                </Typography>
                <Chip
                  size="small"
                  label={weekRangeLabel}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.72rem', fontWeight: 600 }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Quizzes, tests, homework, and hands-on syllabus activities with parent supply checklists (Memoria Academy, Amanda Holliday Math, Science Shepherd)
              </Typography>
            </Box>
          </Stack>

          <Button
            component={RouterLink}
            href="/automations?tab=syllabus"
            size="small"
            sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
          >
            View Syllabi →
          </Button>
        </Box>

        {/* Parent Supply Sourcing Banner when any Activity this week requires supplies */}
        {externalThisWeekItems.some((item) => item.supplies && item.supplies.length > 0) && (
          <Box
            sx={{
              px: 2.25,
              py: 1.75,
              bgcolor: alpha(theme.palette.success.main, 0.06),
              borderBottom: '1px solid',
              borderColor: alpha(theme.palette.success.main, 0.2),
            }}
          >
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Package size={16} color={theme.palette.success.main} />
                <Typography variant="subtitle2" fontWeight={700} color="success.main">
                  Parent Supply Sourcing Checklist for This Week&apos;s Activities
                </Typography>
              </Stack>
              <Grid container spacing={1.5}>
                {externalThisWeekItems
                  .filter((item) => item.supplies && item.supplies.length > 0)
                  .map((actItem) => (
                    <Grid item xs={12} md={6} key={`supply-banner-${actItem.id}`}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: alpha(theme.palette.success.main, 0.28),
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                          sx={{ mb: 0.75 }}
                        >
                          <Typography variant="caption" fontWeight={700}>
                            {actItem.subjectName}
                            {actItem.classNumber ? ` · Class ${actItem.classNumber}` : ''} —{' '}
                            {actItem.title}
                          </Typography>
                          <Chip
                            size="small"
                            color="success"
                            variant="outlined"
                            label={
                              actItem.weekdayLabel
                                ? `${actItem.weekdayLabel} (${actItem.dueDate})`
                                : actItem.dueDate
                            }
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        </Stack>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {actItem.supplies?.map((supply, sIdx) => (
                            <Chip
                              key={`${actItem.id}-supply-${sIdx}`}
                              size="small"
                              label={supply}
                              sx={{
                                height: 20,
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                bgcolor: alpha(theme.palette.success.main, 0.1),
                                color: 'text.primary',
                              }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    </Grid>
                  ))}
              </Grid>
            </Stack>
          </Box>
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.02) }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                  ASSESSMENT / ACTIVITY
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                  CLASS &amp; PROVIDER
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                  CATEGORY
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                  SUPPLIES NEEDED
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                  OPENS
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}>
                  SCHEDULED DAY / DUE
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}
                >
                  STATUS / GRADE
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {externalThisWeekItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No external quizzes, tests, assignments, or syllabus activities are scheduled for this week ({weekRangeLabel}).
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                externalThisWeekItems.map((item) => {
                  const isActivityRow = item.categoryLabel.toLowerCase() === 'activity';
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                            {isActivityRow && (
                              <Sparkles size={14} color={theme.palette.success.main} />
                            )}
                            <Typography variant="body2" fontWeight={600}>
                              {item.title}
                            </Typography>
                            {item.weekNumber !== null && (
                              <Chip
                                size="small"
                                label={`Week ${item.weekNumber}`}
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                              />
                            )}
                            {item.classNumber !== null && item.classNumber !== undefined && (
                              <Chip
                                size="small"
                                label={`Class ${item.classNumber}`}
                                color="success"
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                              />
                            )}
                          </Stack>
                          {item.classTopic && (
                            <Typography variant="caption" color="text.secondary">
                              Follows Lesson: {item.classTopic}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: item.subjectColor,
                              flexShrink: 0,
                            }}
                          />
                          <Box>
                            <Typography variant="caption" fontWeight={700} display="block">
                              {item.subjectName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.courseSubtitle
                                ? `${item.courseSubtitle} · ${item.providerName}`
                                : item.providerName}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={item.categoryLabel}
                          color={isActivityRow ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 290 }}>
                        {item.supplies && item.supplies.length > 0 ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {item.supplies.map((supply, sIdx) => (
                              <Chip
                                key={`${item.id}-tbl-supply-${sIdx}`}
                                size="small"
                                label={supply}
                                sx={{
                                  height: 19,
                                  fontSize: '0.66rem',
                                  fontWeight: 600,
                                  bgcolor: alpha(theme.palette.success.main, 0.1),
                                }}
                              />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {item.openDate || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.15}>
                          {item.weekdayLabel && (
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color={isActivityRow ? 'success.main' : 'text.primary'}
                            >
                              {item.weekdayLabel}
                            </Typography>
                          )}
                          <Typography
                            variant="caption"
                            fontWeight={600}
                            color="text.secondary"
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {item.dueDate}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          {item.isScored && item.scoreDisplay ? (
                            <Chip
                              size="small"
                              color="success"
                              label={item.scoreDisplay}
                              sx={{
                                height: 22,
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                          ) : (
                            <Chip
                              size="small"
                              icon={<Clock size={12} />}
                              color={item.statusLabel === 'Due This Week' ? 'warning' : 'info'}
                              variant="outlined"
                              label={item.statusLabel}
                              sx={{ height: 22, fontWeight: 600, fontSize: '0.7rem' }}
                            />
                          )}
                          {item.assignmentRecord && (
                            <Tooltip title="Edit or Enter Grade">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  if (item.assignmentRecord) {
                                    setEditingAssignment(item.assignmentRecord);
                                    setModalOpen(true);
                                  }
                                }}
                              >
                                <Edit3 size={14} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Unified Assignment Modal for Quick Grade Entry from Dashboard */}
      <UnifiedAssignmentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAssignment(null);
        }}
        subjects={subjects}
        assignmentTypes={assignmentTypes}
        editingAssignment={editingAssignment}
        onSaved={(savedAssignment) => {
          if (savedAssignment) {
            setAssignments((prev) => {
              const exists = prev.some((a) => a.id === savedAssignment.id);
              return exists
                ? prev.map((a) => (a.id === savedAssignment.id ? savedAssignment : a))
                : [savedAssignment, ...prev];
            });
          }
          setModalOpen(false);
          setEditingAssignment(null);
        }}
      />
    </Box>
  );
}
