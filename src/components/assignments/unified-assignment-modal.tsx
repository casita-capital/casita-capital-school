'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AlertTriangle,
  Calculator,
  Calendar,
  CheckCircle2,
  CloudDownload,
  FileText,
  Lock,
  Repeat,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  getActiveCourseSyllabus,
  parseRecurringConfig,
  resolveSyllabusDaySupplies,
} from 'src/utils/recurring-planner';
import {
  AssignmentSourceType,
  AssignmentTypeConfig,
  AutoBehaviorMode,
  computeAssignmentMetrics,
  DEFAULT_ASSIGNMENT_TYPES,
  formatClassGradeDisplay,
  GradebookAssignment,
  isAssignmentApiSynced,
  LinkedWeeklySource,
  MoodleAssignmentMetadata,
  parseAssignmentMoodleMeta,
  parseSubjectGradingPolicy,
  percentageToLetterGrade,
  RecurringAssignmentTemplate,
  ScoringMode,
  SubjectWithGrading,
  WorkflowStatus,
} from 'src/utils/gradebook-calculator';

export interface UnifiedAssignmentModalInitialValues {
  subject_id?: string;
  title?: string;
  description?: string;
  instructions?: string;
  assigned_date?: string;
  due_date?: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  is_graded?: boolean;
  grading_mode?: ScoringMode;
  points_possible?: number;
  total_problems?: number | null;
  missed_problems?: number | null;
  workflow_status?: WorkflowStatus;
  source_type?: AssignmentSourceType;
  syllabus_day_number?: number | null;
  linked_note_id?: string | null;
  term_name?: string;
  academic_year?: string;
  entry_mode?: 'single' | 'recurring_template';
}

interface UnifiedAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  subjects: SubjectWithGrading[];
  assignmentTypes?: AssignmentTypeConfig[];
  editingAssignment?: GradebookAssignment | null;
  editingTemplate?: RecurringAssignmentTemplate | null;
  initialValues?: UnifiedAssignmentModalInitialValues;
  onSaved?: (
    savedAssignment?: GradebookAssignment,
    savedTemplate?: RecurringAssignmentTemplate
  ) => void;
  onOpenManageTypes?: () => void;
}

const HOLIDAY_MONDAYS = new Set([
  '2026-11-23',
  '2026-12-21',
  '2026-12-28',
  '2027-03-22',
]);

const DAY_KEY_OFFSETS: Record<DayKey, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
};

function addDaysUtc(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Helper to revert a manual override on an API-synced assignment back to either:
 * - 'original_api': the original API value stored in state_standards.moodle_meta
 * - 'blank': ungraded/blank state
 * Both clear `manual_override: false` so the next API pull will overwrite the grade normally.
 */
export async function revertApiAssignmentOverride(
  assignment: GradebookAssignment,
  mode: 'original_api' | 'blank'
): Promise<GradebookAssignment | null> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();
  const existingMeta = parseAssignmentMoodleMeta(assignment.state_standards);

  const apiRaw =
    existingMeta?.api_grade_raw !== undefined ? existingMeta.api_grade_raw : null;
  const apiMax =
    typeof existingMeta?.api_grade_max === 'number' && existingMeta.api_grade_max > 0
      ? existingMeta.api_grade_max
      : assignment.points_possible ?? 100;
  const apiPct =
    existingMeta?.api_percentage_score !== undefined
      ? existingMeta.api_percentage_score
      : apiRaw !== null && apiMax > 0
      ? Number(((apiRaw / apiMax) * 100).toFixed(2))
      : null;
  const apiLetter =
    existingMeta?.api_letter_grade !== undefined
      ? existingMeta.api_letter_grade
      : apiPct !== null
      ? percentageToLetterGrade(apiPct)
      : null;
  const apiFeedback =
    existingMeta?.api_feedback !== undefined ? existingMeta.api_feedback : null;

  const updatedMeta: MoodleAssignmentMetadata = {
    ...(existingMeta || {}),
    api_grade_raw: apiRaw,
    api_grade_max: apiMax,
    api_percentage_score: apiPct,
    api_letter_grade: apiLetter,
    api_feedback: apiFeedback,
    manual_override: false,
    manual_override_at: null,
  };

  const restoreScore = mode === 'original_api' && apiRaw !== null;

  const payload = {
    points_possible: apiMax,
    points_earned: restoreScore ? apiRaw : null,
    percentage_score: restoreScore ? apiPct : null,
    letter_grade: restoreScore ? apiLetter : null,
    total_problems: null,
    missed_problems: null,
    status: restoreScore ? ('completed' as const) : ('pending' as const),
    workflow_status: restoreScore ? ('completed' as const) : ('not_started' as const),
    completed_at: restoreScore ? nowIso : null,
    teacher_comments: mode === 'original_api' ? apiFeedback : null,
    state_standards: {
      moodle_meta: JSON.parse(JSON.stringify(updatedMeta)),
    } as unknown as Json,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from('assignments')
    .update(payload)
    .eq('id', assignment.id)
    .select('*')
    .single();

  if (error || !data) {
    toast.error(`Failed to revert API grade override: ${error?.message || 'Unknown error'}`);
    return null;
  }

  return data as unknown as GradebookAssignment;
}

export interface ApiGradeOverrideWarningModalProps {
  open: boolean;
  onClose: () => void;
  assignment: GradebookAssignment | null;
  subject?: SubjectWithGrading | null;
  onUpdated: (updated: GradebookAssignment) => void;
  onOpenFullEditor?: (assignment: GradebookAssignment) => void;
}

/**
 * REALLY OBVIOUS warning & override modal for API-synced grades.
 * Prevents accidental inline editing of API-pulled grades, warns the user prominently,
 * allows intentional manual override (persisted across future API syncs), and provides
 * one-click revert to Original API Value or Blank.
 */
export function ApiGradeOverrideWarningModal({
  open,
  onClose,
  assignment,
  subject,
  onUpdated,
  onOpenFullEditor,
}: ApiGradeOverrideWarningModalProps) {
  const theme = useTheme();
  const supabase = createClient();

  const [confirmedContinue, setConfirmedContinue] = useState(false);
  const [pointsEarned, setPointsEarned] = useState('');
  const [pointsPossible, setPointsPossible] = useState('100');
  const [teacherComments, setTeacherComments] = useState('');
  const [saving, setSaving] = useState(false);

  const moodleMeta = useMemo(
    () => (assignment ? parseAssignmentMoodleMeta(assignment.state_standards) : null),
    [assignment]
  );

  const isCurrentlyOverridden = Boolean(moodleMeta?.manual_override);

  useEffect(() => {
    if (!open || !assignment) return;
    setConfirmedContinue(false);
    setPointsEarned(
      typeof assignment.points_earned === 'number'
        ? String(assignment.points_earned)
        : ''
    );
    setPointsPossible(String(assignment.points_possible ?? 100));
    setTeacherComments(assignment.teacher_comments || '');
  }, [open, assignment]);

  if (!open || !assignment) return null;

  const policy = subject
    ? parseSubjectGradingPolicy(subject)
    : parseSubjectGradingPolicy({
        id: '',
        name: 'Course',
        sort_order: 0,
        color: '#0C74E4',
      });

  const apiRaw =
    moodleMeta?.api_grade_raw !== undefined
      ? moodleMeta.api_grade_raw
      : !isCurrentlyOverridden
      ? assignment.points_earned ?? null
      : null;
  const apiMax =
    typeof moodleMeta?.api_grade_max === 'number' && moodleMeta.api_grade_max > 0
      ? moodleMeta.api_grade_max
      : assignment.points_possible ?? 100;
  const apiPct =
    moodleMeta?.api_percentage_score !== undefined
      ? moodleMeta.api_percentage_score
      : apiRaw !== null && apiMax > 0
      ? Number(((apiRaw / apiMax) * 100).toFixed(2))
      : null;
  const apiLetter =
    moodleMeta?.api_letter_grade ||
    (apiPct !== null ? percentageToLetterGrade(apiPct, policy.grading_scale) : null);

  const parsedEarned = pointsEarned.trim() !== '' ? Number(pointsEarned) : null;
  const parsedPossible =
    pointsPossible.trim() !== '' ? Number(pointsPossible) : apiMax;
  const liveMetrics = computeAssignmentMetrics({
    grading_mode: 'points',
    points_earned: parsedEarned,
    points_possible: parsedPossible,
    workflow_status: 'completed',
    scale: policy.grading_scale,
  });

  const handleSaveManualOverride = async () => {
    if (parsedEarned === null || Number.isNaN(parsedEarned)) {
      toast.error('Please enter a numeric Points Earned value to override the API grade.');
      return;
    }

    setSaving(true);
    const nowIso = new Date().toISOString();
    try {
      const updatedMeta: MoodleAssignmentMetadata = {
        ...(moodleMeta || {}),
        api_grade_raw: apiRaw,
        api_grade_max: apiMax,
        api_percentage_score: apiPct,
        api_letter_grade: apiLetter,
        api_feedback:
          moodleMeta?.api_feedback !== undefined
            ? moodleMeta.api_feedback
            : !isCurrentlyOverridden
            ? assignment.teacher_comments || null
            : null,
        manual_override: true,
        manual_override_at: nowIso,
      };

      const payload = {
        points_possible: liveMetrics.points_possible,
        points_earned: liveMetrics.points_earned,
        percentage_score: liveMetrics.percentage_score,
        letter_grade: liveMetrics.letter_grade,
        status: 'completed' as const,
        workflow_status: 'completed' as const,
        completed_at: nowIso,
        teacher_comments: teacherComments.trim() || null,
        state_standards: {
          moodle_meta: JSON.parse(JSON.stringify(updatedMeta)),
        } as unknown as Json,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from('assignments')
        .update(payload)
        .eq('id', assignment.id)
        .select('*')
        .single();

      if (error || !data) {
        toast.error(`Failed to save manual override: ${error?.message || 'Error'}`);
        return;
      }

      toast.success(
        'Manual grade override saved & locked! Future API pulls will not overwrite this grade.'
      );
      onUpdated(data as unknown as GradebookAssignment);
      onClose();
    } catch {
      toast.error('Error saving manual override');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (mode: 'original_api' | 'blank') => {
    setSaving(true);
    try {
      const reverted = await revertApiAssignmentOverride(assignment, mode);
      if (reverted) {
        toast.success(
          mode === 'original_api'
            ? 'Removed manual override and restored Original API Grade (unlocked for future API syncs).'
            : 'Removed manual override and reverted grade to Blank (unlocked for future API syncs).'
        );
        onUpdated(reverted);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        bgcolor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: '100%',
          maxWidth: 620,
          borderRadius: 2.5,
          border: '3px solid',
          borderColor: 'error.main',
          boxShadow: '0 28px 60px -12px rgba(220, 38, 38, 0.35)',
          overflow: 'hidden',
        }}
      >
        {/* OBVIOUS HIGH-CONTRAST WARNING HEADER */}
        <Box
          sx={{
            p: 2.5,
            bgcolor: 'error.main',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1.75} alignItems="center">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={28} color="#ffffff" />
            </Box>
            <Box>
              <Typography
                variant="overline"
                sx={{
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  color: 'rgba(255, 255, 255, 0.92)',
                  display: 'block',
                  lineHeight: 1.1,
                }}
              >
                PROTECTED API-SYNCED GRADE
              </Typography>
              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2, mt: 0.25 }}>
                This Grade Is Imported via API &mdash; Do Not Change
              </Typography>
            </Box>
          </Stack>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: '#ffffff', bgcolor: 'rgba(255,255,255,0.14)' }}
          >
            <X size={18} />
          </IconButton>
        </Box>

        {/* BODY */}
        <Box sx={{ p: 3 }}>
          <Stack spacing={2.25}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.warning.main, 0.08),
                borderColor: 'warning.main',
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <AlertTriangle
                  size={20}
                  color={
                    theme.palette.mode === 'dark'
                      ? theme.palette.warning.light
                      : theme.palette.warning.dark
                  }
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <Box>
                  <Typography variant="body2" fontWeight={800} color="text.primary" gutterBottom>
                    {subject?.name || 'API-Synced Class'}: {assignment.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                    Grades for <strong>{subject?.name || 'this class'}</strong> are automatically pulled from the{' '}
                    <strong>Memoria Academy API</strong> and should not normally be edited manually.
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.55, mt: 0.75 }}
                  >
                    If you choose to <strong>Continue to Manual Override</strong>, your custom grade will be{' '}
                    <strong>flagged as a Manual Entry</strong> and <strong>protected</strong> so future API syncs will{' '}
                    <strong>NOT overwrite it</strong> unless you revert it back to the original API value or blank.
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* SIDE-BY-SIDE COMPARISON: ORIGINAL API VALUE vs CURRENT DISPLAY VALUE */}
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.75,
                    borderRadius: 1.5,
                    height: '100%',
                    bgcolor: alpha(theme.palette.info.main, 0.04),
                    borderColor: alpha(theme.palette.info.main, 0.3),
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
                    <CloudDownload size={14} color={theme.palette.info.main} />
                    <Typography
                      variant="caption"
                      fontWeight={800}
                      color="info.main"
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      Original API Value
                    </Typography>
                  </Stack>
                  <Typography variant="subtitle1" fontWeight={800}>
                    {apiRaw !== null && apiPct !== null
                      ? `${apiRaw.toFixed(2)} / ${apiMax} (${apiPct.toFixed(1)}%${
                          apiLetter ? ` • ${apiLetter}` : ''
                        })`
                      : 'Pending / Blank in API'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Synced from Memoria Academy Portal
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.75,
                    borderRadius: 1.5,
                    height: '100%',
                    bgcolor: isCurrentlyOverridden
                      ? alpha(theme.palette.warning.main, 0.1)
                      : 'background.paper',
                    borderColor: isCurrentlyOverridden ? 'warning.main' : 'divider',
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
                    {isCurrentlyOverridden ? (
                      <Unlock
                        size={14}
                        color={
                          theme.palette.mode === 'dark'
                            ? theme.palette.warning.light
                            : theme.palette.warning.dark
                        }
                      />
                    ) : (
                      <Lock size={14} color={theme.palette.success.main} />
                    )}
                    <Typography
                      variant="caption"
                      fontWeight={800}
                      color={
                        isCurrentlyOverridden
                          ? theme.palette.mode === 'dark'
                            ? 'warning.light'
                            : 'warning.dark'
                          : 'success.main'
                      }
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      {isCurrentlyOverridden
                        ? 'Current Value (MANUAL OVERRIDE)'
                        : 'Current Value (API Synced)'}
                    </Typography>
                  </Stack>
                  <Typography variant="subtitle1" fontWeight={800}>
                    {typeof assignment.points_earned === 'number' &&
                    typeof assignment.percentage_score === 'number'
                      ? `${assignment.points_earned.toFixed(2)} / ${
                          assignment.points_possible ?? 100
                        } (${assignment.percentage_score.toFixed(1)}%)`
                      : 'Ungraded / Blank'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isCurrentlyOverridden
                      ? 'Locked against API overwrite'
                      : 'Automatically updated by API pulls'}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* REVERT CONTROLS (Always visible if already overridden, or inside override step) */}
            {(isCurrentlyOverridden || confirmedContinue) && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.75,
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.text.primary, 0.02),
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={800}
                  color="text.secondary"
                  display="block"
                  mb={1}
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  Remove Manual Override &amp; Resume Automatic API Sync:
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    color="info"
                    disabled={saving}
                    startIcon={<RotateCcw size={15} />}
                    onClick={() => handleRevert('original_api')}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Revert to Original API Value (
                    {apiRaw !== null ? `${apiRaw.toFixed(2)} / ${apiMax}` : 'Blank'})
                  </Button>
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    color="secondary"
                    disabled={saving}
                    startIcon={<RotateCcw size={15} />}
                    onClick={() => handleRevert('blank')}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Revert to Blank (Ungraded)
                  </Button>
                </Stack>
              </Paper>
            )}

            {/* STEP 1 vs STEP 2 */}
            {!confirmedContinue ? (
              <Box
                sx={{
                  pt: 0.5,
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Button
                  variant="contained"
                  color="primary"
                  size="medium"
                  onClick={onClose}
                  sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}
                >
                  Cancel &mdash; Keep API Sync
                </Button>

                <Stack direction="row" spacing={1} alignItems="center">
                  {onOpenFullEditor && (
                    <Button
                      variant="text"
                      color="inherit"
                      size="small"
                      onClick={() => {
                        onClose();
                        onOpenFullEditor(assignment);
                      }}
                      sx={{ fontWeight: 600, textTransform: 'none' }}
                    >
                      View Details
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    color="warning"
                    size="medium"
                    startIcon={<Unlock size={16} />}
                    onClick={() => setConfirmedContinue(true)}
                    sx={{ fontWeight: 800, textTransform: 'none', px: 2.5 }}
                  >
                    Continue to Manual Override &rarr;
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 2,
                  borderColor: 'warning.main',
                  bgcolor: alpha(theme.palette.warning.main, 0.04),
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={800}
                  color={theme.palette.mode === 'dark' ? 'warning.light' : 'warning.dark'}
                  mb={1.5}
                >
                  Enter Manual Override Score (Will Be Locked Against Future API Pulls)
                </Typography>

                <Grid container spacing={1.5} alignItems="center" mb={1.5}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Override Points Earned"
                      placeholder="e.g. 95"
                      InputLabelProps={{ shrink: true }}
                      value={pointsEarned}
                      onChange={(e) => setPointsEarned(e.target.value)}
                      inputProps={{ step: '0.01' }}
                      autoFocus
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Points Possible"
                      InputLabelProps={{ shrink: true }}
                      value={pointsPossible}
                      onChange={(e) => setPointsPossible(e.target.value)}
                      inputProps={{ min: 1, step: '0.5' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1,
                        textAlign: 'center',
                        borderRadius: 1.5,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" display="block">
                        Resulting Override Grade
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={800}
                        color={
                          liveMetrics.is_scored
                            ? theme.palette.mode === 'dark'
                              ? 'warning.light'
                              : 'warning.dark'
                            : 'text.secondary'
                        }
                      >
                        {liveMetrics.is_scored
                          ? formatClassGradeDisplay(
                              liveMetrics.percentage_score,
                              liveMetrics.letter_grade || '',
                              policy
                            )
                          : 'Enter Score'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <TextField
                  fullWidth
                  size="small"
                  label="Override Note / Teacher Feedback (Optional)"
                  placeholder="Reason for manual grade override..."
                  InputLabelProps={{ shrink: true }}
                  value={teacherComments}
                  onChange={(e) => setTeacherComments(e.target.value)}
                  sx={{ mb: 2 }}
                />

                <Stack direction="row" spacing={1.25} justifyContent="flex-end">
                  <Button
                    color="inherit"
                    onClick={onClose}
                    sx={{ fontWeight: 600, textTransform: 'none' }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="warning"
                    disabled={saving}
                    startIcon={
                      saving ? <CircularProgress size={15} /> : <Save size={15} />
                    }
                    onClick={handleSaveManualOverride}
                    sx={{ fontWeight: 800, textTransform: 'none', px: 2.5 }}
                  >
                    {saving ? 'Saving Override...' : 'Save Manual Override & Lock'}
                  </Button>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

export interface QuickGradeAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  assignment: GradebookAssignment | null;
  subject?: SubjectWithGrading | null;
  assignmentTypes?: AssignmentTypeConfig[];
  onSaved: (updated: GradebookAssignment) => void;
  onEditAssignment: (assignment: GradebookAssignment) => void;
}

/**
 * Compact "Enter Grade" modal that displays ONLY the green grading card from the
 * assignment editor, plus bottom-left "Edit Assignment" and bottom-right "Cancel" / "Save Grade".
 */
export function QuickGradeAssignmentModal({
  open,
  onClose,
  assignment,
  subject,
  assignmentTypes = DEFAULT_ASSIGNMENT_TYPES,
  onSaved,
  onEditAssignment,
}: QuickGradeAssignmentModalProps) {
  const theme = useTheme();
  const supabase = createClient();

  const [isGraded, setIsGraded] = useState<boolean>(true);
  const [isExempt, setIsExempt] = useState<boolean>(false);
  const [gradingMode, setGradingMode] = useState<ScoringMode>('points');
  const [pointsPossible, setPointsPossible] = useState<string>('100');
  const [pointsEarned, setPointsEarned] = useState<string>('');
  const [totalProblems, setTotalProblems] = useState<string>('');
  const [missedProblems, setMissedProblems] = useState<string>('');
  const [percentageInput, setPercentageInput] = useState<string>('');
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('not_started');
  const [saving, setSaving] = useState<boolean>(false);

  const effectiveTypes =
    assignmentTypes.length > 0 ? assignmentTypes : DEFAULT_ASSIGNMENT_TYPES;

  useEffect(() => {
    if (!open || !assignment) return;
    const typeCfg = effectiveTypes.find((t) => t.slug === assignment.category);
    const defaultMode: ScoringMode =
      assignment.grading_mode ||
      typeCfg?.scoring_mode ||
      (assignment.category === 'spelling_test' ||
      assignment.category === 'math_problem_set'
        ? 'problems_calculator'
        : 'points');

    setIsGraded(assignment.is_graded ?? true);
    setIsExempt(Boolean(assignment.is_exempt));
    setGradingMode(defaultMode);
    setPointsPossible(String(assignment.points_possible ?? typeCfg?.default_points ?? 100));
    setPointsEarned(
      typeof assignment.points_earned === 'number'
        ? String(assignment.points_earned)
        : ''
    );
    setTotalProblems(
      typeof assignment.total_problems === 'number'
        ? String(assignment.total_problems)
        : assignment.category === 'spelling_test'
        ? '20'
        : ''
    );
    setMissedProblems(
      typeof assignment.missed_problems === 'number'
        ? String(assignment.missed_problems)
        : ''
    );
    setPercentageInput(
      typeof assignment.percentage_score === 'number'
        ? String(assignment.percentage_score)
        : ''
    );
    setWorkflowStatus(assignment.workflow_status || 'not_started');
  }, [open, assignment, effectiveTypes]);

  if (!open || !assignment) return null;

  const activeSubjectPolicy = subject
    ? parseSubjectGradingPolicy(subject)
    : parseSubjectGradingPolicy({
        id: '',
        name: 'Course',
        sort_order: 0,
        color: '#0C74E4',
      });

  const parsedTotalProblems =
    totalProblems.trim() !== '' ? Number(totalProblems) : null;
  const parsedMissedProblems =
    missedProblems.trim() !== '' ? Number(missedProblems) : null;
  const parsedPointsPossible =
    pointsPossible.trim() !== '' ? Number(pointsPossible) : 100;
  const parsedPointsEarned =
    pointsEarned.trim() !== '' ? Number(pointsEarned) : null;
  const parsedPercentage =
    percentageInput.trim() !== '' ? Number(percentageInput) : null;

  const liveMetrics = computeAssignmentMetrics({
    grading_mode: gradingMode,
    total_problems: parsedTotalProblems,
    missed_problems: parsedMissedProblems,
    points_possible: parsedPointsPossible,
    points_earned: parsedPointsEarned,
    percentage_score: parsedPercentage,
    workflow_status: workflowStatus,
    scale: activeSubjectPolicy.grading_scale,
  });

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const nowIso = new Date().toISOString();

    try {
      const effectiveWorkflow: WorkflowStatus =
        isExempt || !isGraded || liveMetrics.is_scored ? 'completed' : workflowStatus;

      const legacyStatus: 'pending' | 'completed' =
        effectiveWorkflow === 'completed' || isExempt ? 'completed' : 'pending';

      const payload = {
        is_graded: isGraded,
        is_exempt: isExempt,
        grading_mode: gradingMode,
        points_possible: isGraded ? liveMetrics.points_possible : 0,
        points_earned: isGraded ? liveMetrics.points_earned : null,
        total_problems:
          isGraded && gradingMode === 'problems_calculator'
            ? parsedTotalProblems
            : null,
        missed_problems:
          isGraded && gradingMode === 'problems_calculator'
            ? parsedMissedProblems
            : null,
        percentage_score: isGraded ? liveMetrics.percentage_score : null,
        letter_grade: isGraded ? liveMetrics.letter_grade : null,
        workflow_status: effectiveWorkflow,
        status: legacyStatus,
        completed_at:
          legacyStatus === 'completed'
            ? assignment.completed_at || nowIso
            : null,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from('assignments')
        .update(payload)
        .eq('id', assignment.id)
        .select('*')
        .single();

      if (error || !data) {
        toast.error(`Failed to save grade: ${error?.message || 'Unknown error'}`);
        return;
      }

      const updated = data as unknown as GradebookAssignment;
      toast.success(
        isGraded && liveMetrics.is_scored
          ? `Saved grade for "${updated.title}": ${formatClassGradeDisplay(
              updated.percentage_score ?? null,
              updated.letter_grade || '',
              activeSubjectPolicy
            )}`
          : `Updated "${updated.title}"`
      );
      onSaved(updated);
      onClose();
    } catch {
      toast.error('Error saving grade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1450,
        bgcolor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: '100%',
          maxWidth: 620,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.2)',
          overflow: 'hidden',
        }}
      >
        <form onSubmit={handleSaveGrade}>
          {/* COMPACT HEADER */}
          <Box
            px={2.5}
            py={1.75}
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              {subject && (
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: subject.color,
                    flexShrink: 0,
                  }}
                />
              )}
              <Typography
                variant="subtitle1"
                fontWeight={700}
                noWrap
                sx={{ letterSpacing: '-0.01em' }}
              >
                {assignment.title}
              </Typography>
            </Stack>
            <IconButton size="small" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </Box>

          {/* GREEN GRADING SECTION (MATCHING SCREENSHOT) */}
          <Box sx={{ p: 2.5 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.25,
                borderRadius: 1.5,
                bgcolor: isGraded
                  ? alpha(theme.palette.success.main, 0.03)
                  : 'action.hover',
                borderColor: isGraded
                  ? alpha(theme.palette.success.main, 0.3)
                  : 'divider',
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                gap={1}
                mb={isGraded ? 2 : 0}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        color="success"
                        checked={isGraded}
                        onChange={(e) => setIsGraded(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={700}>
                        {isGraded ? 'Graded Assignment' : 'Ungraded (Checklist Only)'}
                      </Typography>
                    }
                  />
                  {isGraded && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={isExempt}
                          onChange={(e) => setIsExempt(e.target.checked)}
                        />
                      }
                      label={
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}
                        >
                          EXEMPT
                        </Typography>
                      }
                    />
                  )}
                </Stack>

                {isGraded && (
                  <TextField
                    select
                    SelectProps={{ native: true }}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                    label="Scoring Method"
                    value={gradingMode}
                    onChange={(e) => setGradingMode(e.target.value as ScoringMode)}
                    sx={{ minWidth: 235 }}
                  >
                    <option value="points">Points (Earned / Possible)</option>
                    <option value="problems_calculator">
                      Problems / Words (Total / Missed)
                    </option>
                    <option value="percentage">Percentage (0–100%)</option>
                    <option value="completion">Completion (100%)</option>
                  </TextField>
                )}
              </Stack>

              {isGraded && (
                <>
                  {gradingMode === 'problems_calculator' && (
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label={
                            assignment.category === 'spelling_test'
                              ? 'Total Words (18–20)'
                              : 'Total Problems'
                          }
                          placeholder={
                            assignment.category === 'spelling_test' ? '20' : '25'
                          }
                          InputLabelProps={{ shrink: true }}
                          value={totalProblems}
                          onChange={(e) => setTotalProblems(e.target.value)}
                          inputProps={{ min: 1 }}
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label={
                            assignment.category === 'spelling_test'
                              ? 'Missed Words'
                              : 'Missed Problems'
                          }
                          InputLabelProps={{ shrink: true }}
                          value={missedProblems}
                          onChange={(e) => setMissedProblems(e.target.value)}
                          inputProps={{ min: 0 }}
                          autoFocus
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1,
                            textAlign: 'center',
                            borderRadius: 1.25,
                            bgcolor: 'background.paper',
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                              fontSize: '0.65rem',
                            }}
                          >
                            GRADE
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            color={
                              liveMetrics.is_scored ? 'success.main' : 'text.secondary'
                            }
                          >
                            {liveMetrics.is_scored
                              ? formatClassGradeDisplay(
                                  liveMetrics.percentage_score,
                                  liveMetrics.letter_grade || '',
                                  activeSubjectPolicy
                                )
                              : 'Ungraded'}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  )}

                  {gradingMode === 'points' && (
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Points Earned"
                          placeholder="Score"
                          InputLabelProps={{ shrink: true }}
                          value={pointsEarned}
                          onChange={(e) => setPointsEarned(e.target.value)}
                          inputProps={{ step: '0.01' }}
                          autoFocus
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Points Possible"
                          InputLabelProps={{ shrink: true }}
                          value={pointsPossible}
                          onChange={(e) => setPointsPossible(e.target.value)}
                          inputProps={{ min: 1, step: '0.5' }}
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1,
                            textAlign: 'center',
                            borderRadius: 1.25,
                            bgcolor: 'background.paper',
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                              fontSize: '0.65rem',
                            }}
                          >
                            GRADE
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            color={
                              liveMetrics.is_scored ? 'success.main' : 'text.secondary'
                            }
                          >
                            {liveMetrics.is_scored
                              ? formatClassGradeDisplay(
                                  liveMetrics.percentage_score,
                                  liveMetrics.letter_grade || '',
                                  activeSubjectPolicy
                                )
                              : 'Ungraded'}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  )}

                  {gradingMode === 'percentage' && (
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Percentage Score (%)"
                          InputLabelProps={{ shrink: true }}
                          value={percentageInput}
                          onChange={(e) => setPercentageInput(e.target.value)}
                          autoFocus
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">%</InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1,
                            textAlign: 'center',
                            borderRadius: 1.25,
                            bgcolor: 'background.paper',
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                              fontSize: '0.65rem',
                            }}
                          >
                            GRADE
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            color={
                              liveMetrics.is_scored ? 'success.main' : 'text.secondary'
                            }
                          >
                            {liveMetrics.is_scored
                              ? formatClassGradeDisplay(
                                  liveMetrics.percentage_score,
                                  liveMetrics.letter_grade || '',
                                  activeSubjectPolicy
                                )
                              : 'Ungraded'}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  )}

                  {(gradingMode === 'completion' || gradingMode === 'pass_fail') && (
                    <Button
                      variant={
                        workflowStatus === 'completed' ? 'contained' : 'outlined'
                      }
                      color="success"
                      size="small"
                      startIcon={<CheckCircle2 size={15} />}
                      onClick={() => {
                        setWorkflowStatus('completed');
                        setPointsEarned(pointsPossible);
                      }}
                      sx={{ fontWeight: 600, textTransform: 'none' }}
                    >
                      Mark Completed (100%)
                    </Button>
                  )}
                </>
              )}
            </Paper>
          </Box>

          {/* FOOTER: Bottom-left "Edit Assignment", Bottom-right "Cancel" + "Save Grade" */}
          <Box
            px={2.5}
            py={1.75}
            sx={{
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Button
              type="button"
              variant="outlined"
              color="inherit"
              size="small"
              onClick={() => {
                onClose();
                onEditAssignment(assignment);
              }}
              sx={{
                fontWeight: 600,
                textTransform: 'none',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              Edit Assignment
            </Button>

            <Stack direction="row" spacing={1.25} alignItems="center">
              <Button
                type="button"
                onClick={onClose}
                color="inherit"
                sx={{ fontWeight: 600, textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={saving}
                startIcon={
                  saving ? <CircularProgress size={15} /> : <Save size={15} />
                }
                sx={{ fontWeight: 700, px: 2.5, textTransform: 'none' }}
              >
                {saving ? 'Saving...' : 'Save Grade'}
              </Button>
            </Stack>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}

export function UnifiedAssignmentModal({
  open,
  onClose,
  subjects,
  assignmentTypes = DEFAULT_ASSIGNMENT_TYPES,
  editingAssignment = null,
  editingTemplate = null,
  initialValues,
  onSaved,
}: UnifiedAssignmentModalProps) {
  const theme = useTheme();
  const supabase = createClient();

  const effectiveTypes =
    assignmentTypes.length > 0 ? assignmentTypes : DEFAULT_ASSIGNMENT_TYPES;

  const [entryMode, setEntryMode] = useState<'single' | 'recurring_template'>('single');

  // Core Assignment Fields
  const [subjectId, setSubjectId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [categorySlug, setCategorySlug] = useState<string>('homework');

  // Open & Close / Due Dates + Status
  const [assignedDate, setAssignedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('not_started');

  // Grading & Score Fields
  const [isGraded, setIsGraded] = useState<boolean>(true);
  const [gradingMode, setGradingMode] = useState<ScoringMode>('points');
  const [totalProblems, setTotalProblems] = useState<string>('');
  const [missedProblems, setMissedProblems] = useState<string>('');
  const [pointsPossible, setPointsPossible] = useState<string>('100');
  const [pointsEarned, setPointsEarned] = useState<string>('');
  const [percentageInput, setPercentageInput] = useState<string>('');
  const [isExempt, setIsExempt] = useState<boolean>(false);
  const [teacherComments, setTeacherComments] = useState<string>('');

  // API Override Gate inside UnifiedAssignmentModal
  const [apiOverrideUnlocked, setApiOverrideUnlocked] = useState<boolean>(false);

  // Recurring Template Fields (only used when entryMode === 'recurring_template')
  const [recurringDays, setRecurringDays] = useState<DayKey[]>(['thursday']);
  const [linkedWeeklySource, setLinkedWeeklySource] =
    useState<LinkedWeeklySource>('weekly_template');
  const [autoBehavior, setAutoBehavior] = useState<AutoBehaviorMode>('auto_create');
  const [linkedSyllabusClassNum, setLinkedSyllabusClassNum] = useState<number | null>(null);

  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;

    const todayStr = new Date().toISOString().split('T')[0];
    setApiOverrideUnlocked(false);

    if (editingTemplate) {
      setEntryMode('recurring_template');
      setSubjectId(editingTemplate.subject_id || subjects[0]?.id || '');
      setTitle(editingTemplate.title_template);
      setInstructions(editingTemplate.instructions_template || '');
      setCategorySlug(editingTemplate.assignment_type_slug || 'homework');
      setGradingMode(editingTemplate.grading_mode || 'points');
      setPointsPossible(String(editingTemplate.points_possible ?? 100));
      setTotalProblems(
        editingTemplate.total_problems_default !== null
          ? String(editingTemplate.total_problems_default)
          : ''
      );
      setMissedProblems('');
      setRecurringDays(
        editingTemplate.days_of_week.length > 0
          ? editingTemplate.days_of_week
          : ['thursday']
      );
      setLinkedWeeklySource(editingTemplate.linked_weekly_source || 'weekly_template');
      setAutoBehavior(editingTemplate.auto_behavior || 'auto_create');
      setIsGraded(true);
      setLinkedSyllabusClassNum(null);
      return;
    }

    if (editingAssignment) {
      setEntryMode('single');
      setSubjectId(editingAssignment.subject_id || subjects[0]?.id || '');
      setTitle(editingAssignment.title);
      setInstructions(
        editingAssignment.instructions || editingAssignment.description || ''
      );
      setCategorySlug(editingAssignment.category || 'homework');

      const moodleMeta = parseAssignmentMoodleMeta(editingAssignment.state_standards);
      setLinkedSyllabusClassNum(
        moodleMeta?.class_number ?? editingAssignment.syllabus_day_number ?? null
      );
      const resolvedOpenDate =
        editingAssignment.assigned_date ||
        moodleMeta?.official_portal_open_date ||
        editingAssignment.due_date ||
        todayStr;
      const resolvedDueDate =
        editingAssignment.due_date ||
        moodleMeta?.official_portal_due_date ||
        todayStr;

      setAssignedDate(resolvedOpenDate);
      setDueDate(resolvedDueDate);

      const wf: WorkflowStatus =
        editingAssignment.workflow_status ||
        (editingAssignment.status === 'completed'
          ? 'completed'
          : editingAssignment.status === 'in_progress'
          ? 'in_progress'
          : 'not_started');
      setWorkflowStatus(wf);

      setIsGraded(editingAssignment.is_graded ?? true);

      const matchedType = effectiveTypes.find(
        (t) => t.slug === editingAssignment.category
      );
      const effectiveMode: ScoringMode =
        editingAssignment.grading_mode || matchedType?.scoring_mode || 'points';
      setGradingMode(effectiveMode);

      setTotalProblems(
        typeof editingAssignment.total_problems === 'number'
          ? String(editingAssignment.total_problems)
          : ''
      );
      setMissedProblems(
        typeof editingAssignment.missed_problems === 'number'
          ? String(editingAssignment.missed_problems)
          : ''
      );
      setPointsPossible(
        String(
          editingAssignment.points_possible ?? matchedType?.default_points ?? 100
        )
      );
      setPointsEarned(
        typeof editingAssignment.points_earned === 'number'
          ? String(editingAssignment.points_earned)
          : ''
      );
      setPercentageInput(
        typeof editingAssignment.percentage_score === 'number'
          ? String(editingAssignment.percentage_score)
          : ''
      );
      setIsExempt(editingAssignment.is_exempt ?? false);
      setTeacherComments(editingAssignment.teacher_comments || '');
      return;
    }

    // Creating a new assignment or recurring rule
    const initMode = initialValues?.entry_mode || 'single';
    setEntryMode(initMode);

    const defaultSubId = initialValues?.subject_id || subjects[0]?.id || '';
    setSubjectId(defaultSubId);

    const subObj = subjects.find((s) => s.id === defaultSubId);
    const isMathSub = subObj?.name.toLowerCase().includes('math') ?? false;
    const isSpellingSub = subObj?.name.toLowerCase().includes('spelling') ?? false;

    const defaultCat =
      initialValues?.category ||
      (isMathSub ? 'math_problem_set' : isSpellingSub ? 'spelling_test' : 'homework');
    setCategorySlug(defaultCat);
    setLinkedSyllabusClassNum(initialValues?.syllabus_day_number ?? null);

    const matchedType = effectiveTypes.find((t) => t.slug === defaultCat);
    const defaultScoring: ScoringMode =
      initialValues?.grading_mode || matchedType?.scoring_mode || 'points';
    setGradingMode(defaultScoring);

    setTitle(
      initialValues?.title ||
        (initMode === 'recurring_template' && isSpellingSub
          ? 'Week {week} Spelling Test'
          : initMode === 'recurring_template' && isMathSub
          ? 'Day {day} Workbook HW: {workbook}'
          : '')
    );
    setInstructions(initialValues?.instructions || initialValues?.description || '');
    setAssignedDate(initialValues?.assigned_date || initialValues?.due_date || todayStr);
    setDueDate(initialValues?.due_date || todayStr);
    setWorkflowStatus(initialValues?.workflow_status || 'not_started');
    setIsGraded(initialValues?.is_graded ?? matchedType?.is_graded_by_default ?? true);
    setPointsPossible(
      String(initialValues?.points_possible ?? matchedType?.default_points ?? 100)
    );
    setTotalProblems(
      typeof initialValues?.total_problems === 'number'
        ? String(initialValues.total_problems)
        : isSpellingSub
        ? '20'
        : ''
    );
    setMissedProblems(
      typeof initialValues?.missed_problems === 'number'
        ? String(initialValues.missed_problems)
        : ''
    );
    setPointsEarned('');
    setPercentageInput('');
    setIsExempt(false);
    setTeacherComments('');
    setRecurringDays(
      isSpellingSub
        ? ['thursday']
        : isMathSub
        ? ['monday', 'wednesday']
        : ['thursday']
    );
    setLinkedWeeklySource(
      isMathSub ? 'math_workbook' : isSpellingSub ? 'weekly_template' : 'weekly_template'
    );
    setAutoBehavior('auto_create');
  }, [open, editingAssignment, editingTemplate, initialValues, subjects, effectiveTypes]);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId) || null,
    [subjects, subjectId]
  );

  // Extract all syllabus activities for the selected subject so users can link an Activity assignment to any syllabus activity
  const subjectSyllabusActivities = useMemo(() => {
    if (!activeSubject) return [];
    const cfg = parseRecurringConfig(activeSubject.recurring_config, activeSubject.name);
    const activeSyl = getActiveCourseSyllabus(cfg);
    if (!activeSyl || !Array.isArray(activeSyl.days) || activeSyl.days.length === 0) return [];

    // Build week monday lookup for 35 school weeks
    const weekMondayByNum = new Map<number, string>();
    let cursorMon = '2026-08-31';
    for (let w = 1; w <= 35; w++) {
      while (HOLIDAY_MONDAYS.has(cursorMon)) {
        cursorMon = addDaysUtc(cursorMon, 7);
      }
      weekMondayByNum.set(w, cursorMon);
      cursorMon = addDaysUtc(cursorMon, 7);
    }

    return activeSyl.days
      .filter((d) => Boolean(d.activity))
      .map((d) => {
        const wkNum = d.week_number ?? Math.ceil(d.day_number / 3);
        const posInWeek = (d.day_number - 1) % 3; // 0 -> Monday, 1 -> Tuesday, 2 -> Wednesday
        const weekdayKey: DayKey =
          posInWeek === 0 ? 'monday' : posInWeek === 1 ? 'tuesday' : 'wednesday';
        const weekMon = weekMondayByNum.get(wkNum) || '2026-08-31';
        const targetDueDate = addDaysUtc(weekMon, posInWeek);
        const supplies = resolveSyllabusDaySupplies(d);
        return {
          classNumber: d.day_number,
          weekNumber: wkNum,
          topic: d.topic,
          activityName: d.activity || '',
          weekdayKey,
          weekdayLabel: DAY_LABELS[weekdayKey],
          openDate: weekMon,
          dueDate: targetDueDate,
          supplies,
        };
      });
  }, [activeSubject]);

  const isEditingApiAssignment = useMemo(
    () =>
      editingAssignment ? isAssignmentApiSynced(editingAssignment, activeSubject) : false,
    [editingAssignment, activeSubject]
  );

  const editingMoodleMeta = useMemo(
    () =>
      editingAssignment
        ? parseAssignmentMoodleMeta(editingAssignment.state_standards)
        : null,
    [editingAssignment]
  );

  // Extract the selected subject's weekly planner checklist lines so the user can 1-click link!
  const subjectWeeklyChecklistItems = useMemo(() => {
    if (!activeSubject) return [];
    const cfg = parseRecurringConfig(activeSubject.recurring_config, activeSubject.name);
    const items: Array<{ dayKey: DayKey; dayLabel: string; line: string }> = [];
    for (const dk of DAY_KEYS) {
      const tpl = cfg.days[dk]?.template || '';
      const lines = tpl
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      for (const l of lines) {
        items.push({ dayKey: dk, dayLabel: DAY_LABELS[dk], line: l });
      }
    }
    return items;
  }, [activeSubject]);

  const activeSubjectPolicy = useMemo(
    () =>
      activeSubject
        ? parseSubjectGradingPolicy(activeSubject)
        : parseSubjectGradingPolicy({
            id: '',
            name: 'Course',
            sort_order: 0,
            color: '#0C74E4',
          }),
    [activeSubject]
  );

  const selectedTypeObj = useMemo(
    () => effectiveTypes.find((t) => t.slug === categorySlug) || null,
    [effectiveTypes, categorySlug]
  );

  const handleCategoryChange = (nextSlug: string) => {
    setCategorySlug(nextSlug);
    const typeInfo = effectiveTypes.find((t) => t.slug === nextSlug);
    if (typeInfo && !editingAssignment) {
      setGradingMode(typeInfo.scoring_mode);
      setPointsPossible(String(typeInfo.default_points));
      setIsGraded(typeInfo.is_graded_by_default);
      if (nextSlug === 'spelling_test' && !totalProblems) {
        setTotalProblems('20');
      }
    }
  };

  const liveMetrics = useMemo(() => {
    const parsedTotalProbs =
      totalProblems.trim() !== '' ? Number(totalProblems) : null;
    const parsedMissedProbs =
      missedProblems.trim() !== '' ? Number(missedProblems) : null;
    const parsedPtsPossible =
      pointsPossible.trim() !== '' ? Number(pointsPossible) : 100;
    const parsedPtsEarned =
      pointsEarned.trim() !== '' ? Number(pointsEarned) : null;
    const parsedPct =
      percentageInput.trim() !== '' ? Number(percentageInput) : null;

    return computeAssignmentMetrics({
      grading_mode: gradingMode,
      total_problems: parsedTotalProbs,
      missed_problems: parsedMissedProbs,
      points_possible: parsedPtsPossible,
      points_earned: parsedPtsEarned,
      percentage_score: parsedPct,
      workflow_status: workflowStatus,
      scale: activeSubjectPolicy.grading_scale,
    });
  }, [
    gradingMode,
    totalProblems,
    missedProblems,
    pointsPossible,
    pointsEarned,
    percentageInput,
    workflowStatus,
    activeSubjectPolicy.grading_scale,
  ]);

  const handleToggleRecurringDay = (day: DayKey) => {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  /**
   * Automatically materializes/updates recurring assignment instances across the 34 school weeks
   * when a recurring rule is created or updated so the user immediately sees them in the
   * Weekly Planner and Gradebook without any manual steps!
   */
  const materializeRecurringTemplateAcrossWeeks = async (
    savedTpl: RecurringAssignmentTemplate
  ): Promise<number> => {
    if (savedTpl.auto_behavior === 'ignore' || !savedTpl.is_active) return 0;

    const nowIso = new Date().toISOString();
    const schoolWeeks: Array<{ week_number: number; monday: string }> = [];
    let cursorMonday = '2026-08-31';
    for (let w = 1; w <= 34; w++) {
      while (HOLIDAY_MONDAYS.has(cursorMonday)) {
        cursorMonday = addDaysUtc(cursorMonday, 7);
      }
      schoolWeeks.push({ week_number: w, monday: cursorMonday });
      cursorMonday = addDaysUtc(cursorMonday, 7);
    }

    const { data: existingData } = await supabase
      .from('assignments')
      .select('id, title, due_date, syllabus_day_number, recurring_template_id, points_earned, percentage_score')
      .eq('subject_id', savedTpl.subject_id);

    const existingList = (existingData || []) as Array<{
      id: string;
      title: string;
      due_date: string;
      syllabus_day_number: number | null;
      recurring_template_id: string | null;
      points_earned: number | null;
      percentage_score: number | null;
    }>;

    const toInsert: Array<Record<string, unknown>> = [];
    const wfStatus: WorkflowStatus =
      savedTpl.auto_behavior === 'queue_for_approval' ? 'staged' : 'not_started';

    for (const wk of schoolWeeks) {
      for (const dayKey of savedTpl.days_of_week) {
        const offset = DAY_KEY_OFFSETS[dayKey] ?? 3;
        const targetDueDate = addDaysUtc(wk.monday, offset);
        const formattedTitle = savedTpl.title_template
          .replace(/\{week\}/g, String(wk.week_number))
          .replace(/\{lesson\}/g, String(wk.week_number))
          .replace(/\{day\}/g, String(wk.week_number))
          .trim();
        const formattedInstructions = (savedTpl.instructions_template || '')
          .replace(/\{week\}/g, String(wk.week_number))
          .replace(/\{lesson\}/g, String(wk.week_number))
          .replace(/\{day\}/g, String(wk.week_number))
          .trim();

        const alreadyExists = existingList.some(
          (ex) =>
            (ex.recurring_template_id === savedTpl.id &&
              ex.syllabus_day_number === wk.week_number &&
              ex.due_date === targetDueDate) ||
            (ex.title.toLowerCase() === formattedTitle.toLowerCase() &&
              ex.due_date === targetDueDate)
        );
        if (alreadyExists) continue;

        toInsert.push({
          subject_id: savedTpl.subject_id,
          title: formattedTitle,
          description:
            formattedInstructions ||
            `Week ${wk.week_number} • Linked to recurring ${activeSubject?.name || ''} planner`,
          instructions: formattedInstructions || null,
          assigned_date: wk.monday,
          due_date: targetDueDate,
          category: savedTpl.assignment_type_slug,
          priority: 'medium',
          status: 'pending',
          workflow_status: wfStatus,
          is_graded: true,
          grading_mode: savedTpl.grading_mode,
          total_problems: savedTpl.total_problems_default,
          missed_problems: null,
          points_possible: savedTpl.points_possible,
          points_earned: null,
          percentage_score: null,
          letter_grade: null,
          is_exempt: false,
          source_type: 'recurring_template',
          recurring_template_id: savedTpl.id,
          syllabus_day_number: wk.week_number,
          term_name: wk.week_number <= 17 ? 'Semester 1 (Fall)' : 'Semester 2 (Spring)',
          academic_year: '2026-2027',
          state_standards: {
            moodle_meta: {
              moodle_category:
                savedTpl.assignment_type_slug === 'spelling_test'
                  ? 'Weekly Spelling Tests'
                  : savedTpl.assignment_type_slug.replace(/_/g, ' '),
              range_formatted: `0–${savedTpl.points_possible}`,
              is_ungraded_bucket: false,
              week_number: wk.week_number,
            },
          },
          updated_at: nowIso,
        });
      }
    }

    if (toInsert.length > 0) {
      await supabase.from('assignments').insert(toInsert);
    }
    return toInsert.length;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter an assignment title');
      return;
    }

    setSaving(true);
    const activeUserName =
      typeof window !== 'undefined'
        ? localStorage.getItem('school_active_user_name') || 'Blake Womble'
        : 'Blake Womble';
    const nowIso = new Date().toISOString();

    try {
      if (entryMode === 'recurring_template') {
        if (!subjectId) {
          toast.error('Please select a subject');
          setSaving(false);
          return;
        }
        if (recurringDays.length === 0) {
          toast.error('Select at least one weekday');
          setSaving(false);
          return;
        }

        const templatePayload = {
          subject_id: subjectId,
          title_template: title.trim(),
          instructions_template: instructions.trim() || '',
          assignment_type_slug: categorySlug,
          grading_mode: gradingMode,
          points_possible: Number(pointsPossible) || 100,
          total_problems_default:
            totalProblems.trim() !== '' ? Number(totalProblems) : null,
          days_of_week: recurringDays as unknown as Json,
          linked_weekly_source: linkedWeeklySource,
          auto_behavior: autoBehavior,
          estimated_minutes: editingTemplate?.estimated_minutes || 30,
          is_active: true,
          updated_at: nowIso,
        };

        if (editingTemplate) {
          const { data, error } = await supabase
            .from('recurring_assignment_templates')
            .update(templatePayload)
            .eq('id', editingTemplate.id)
            .select('*')
            .single();

          if (error) {
            toast.error(`Failed to update recurring rule: ${error.message}`);
            return;
          }
          const savedTpl: RecurringAssignmentTemplate = {
            ...(data as unknown as RecurringAssignmentTemplate),
            days_of_week: recurringDays,
          };
          const generatedCount = await materializeRecurringTemplateAcrossWeeks(savedTpl);
          toast.success(
            generatedCount > 0
              ? `Recurring rule updated & ${generatedCount} weekly assignments synced to Planner & Gradebook!`
              : 'Recurring rule updated!'
          );
          if (onSaved && data) {
            onSaved(undefined, savedTpl);
          }
          onClose();
        } else {
          const { data, error } = await supabase
            .from('recurring_assignment_templates')
            .insert(templatePayload)
            .select('*')
            .single();

          if (error) {
            toast.error(`Failed to create recurring rule: ${error.message}`);
            return;
          }
          const savedTpl: RecurringAssignmentTemplate = {
            ...(data as unknown as RecurringAssignmentTemplate),
            days_of_week: recurringDays,
          };
          const generatedCount = await materializeRecurringTemplateAcrossWeeks(savedTpl);
          toast.success(
            generatedCount > 0
              ? `Recurring rule created & ${generatedCount} weekly assignments automatically populated onto the Weekly Planner and Gradebook!`
              : 'Recurring rule created!'
          );
          if (onSaved && data) {
            onSaved(undefined, savedTpl);
          }
          onClose();
        }
        return;
      }

      if (!dueDate) {
        toast.error('Please select a close / due date');
        setSaving(false);
        return;
      }

      const finalWorkflow: WorkflowStatus =
        liveMetrics.is_scored &&
        workflowStatus !== 'staged' &&
        workflowStatus !== 'ignored'
          ? 'completed'
          : workflowStatus;

      const legacyStatus: 'pending' | 'in_progress' | 'completed' =
        finalWorkflow === 'completed'
          ? 'completed'
          : finalWorkflow === 'in_progress' || finalWorkflow === 'submitted'
          ? 'in_progress'
          : 'pending';

      // Preserve existing state_standards (especially moodle_meta for synced portal assignments or linked syllabus activities)
      const existingMoodleMeta = parseAssignmentMoodleMeta(
        editingAssignment?.state_standards
      );
      const isOverridingApi =
        isEditingApiAssignment &&
        (apiOverrideUnlocked || Boolean(existingMoodleMeta?.manual_override));

      const matchedSylAct =
        linkedSyllabusClassNum !== null
          ? subjectSyllabusActivities.find(
              (sa) => sa.classNumber === linkedSyllabusClassNum
            )
          : undefined;

      const preservedStateStandards: Json =
        existingMoodleMeta || matchedSylAct
          ? ({
              moodle_meta: {
                ...(existingMoodleMeta || {}),
                official_portal_open_date: assignedDate || dueDate,
                official_portal_due_date: dueDate,
                ...(matchedSylAct
                  ? {
                      moodle_category: 'Activity',
                      week_number: matchedSylAct.weekNumber,
                      class_number: matchedSylAct.classNumber,
                      class_topic: matchedSylAct.topic,
                      activity_name: matchedSylAct.activityName,
                      supplies: matchedSylAct.supplies,
                      weekday: matchedSylAct.weekdayKey,
                    }
                  : {}),
                ...(isOverridingApi
                  ? {
                      api_grade_raw:
                        existingMoodleMeta?.api_grade_raw !== undefined
                          ? existingMoodleMeta.api_grade_raw
                          : editingAssignment?.points_earned ?? null,
                      api_grade_max:
                        existingMoodleMeta?.api_grade_max ??
                        editingAssignment?.points_possible ??
                        100,
                      api_percentage_score:
                        existingMoodleMeta?.api_percentage_score !== undefined
                          ? existingMoodleMeta.api_percentage_score
                          : editingAssignment?.percentage_score ?? null,
                      api_letter_grade:
                        existingMoodleMeta?.api_letter_grade !== undefined
                          ? existingMoodleMeta.api_letter_grade
                          : editingAssignment?.letter_grade ?? null,
                      manual_override: true,
                      manual_override_at: nowIso,
                    }
                  : {}),
              },
            } as unknown as Json)
          : (editingAssignment?.state_standards ?? ([] as unknown as Json));

      const assignmentPayload = {
        title: title.trim(),
        description:
          editingAssignment?.description || instructions.trim() || null,
        instructions: instructions.trim() || null,
        subject_id: subjectId || null,
        assigned_date: assignedDate || dueDate,
        due_date: dueDate,
        completed_at:
          finalWorkflow === 'completed'
            ? editingAssignment?.completed_at || nowIso
            : null,
        estimated_minutes: editingAssignment?.estimated_minutes ?? 30,
        actual_minutes: editingAssignment?.actual_minutes ?? null,
        priority: editingAssignment?.priority || initialValues?.priority || 'medium',
        category: categorySlug,
        status: legacyStatus,
        workflow_status: finalWorkflow,
        is_graded: isGraded,
        grading_mode: gradingMode,
        total_problems:
          totalProblems.trim() !== '' ? Number(totalProblems) : null,
        missed_problems:
          missedProblems.trim() !== '' ? Number(missedProblems) : null,
        points_possible: liveMetrics.points_possible,
        points_earned: liveMetrics.points_earned,
        percentage_score: liveMetrics.percentage_score,
        letter_grade: liveMetrics.letter_grade,
        is_exempt: isExempt,
        requires_manual_review:
          editingAssignment?.requires_manual_review ?? false,
        source_type:
          editingAssignment?.source_type ||
          initialValues?.source_type ||
          'manual',
        syllabus_day_number:
          linkedSyllabusClassNum ??
          editingAssignment?.syllabus_day_number ??
          initialValues?.syllabus_day_number ??
          null,
        linked_note_id:
          editingAssignment?.linked_note_id ??
          initialValues?.linked_note_id ??
          null,
        term_name:
          editingAssignment?.term_name ||
          initialValues?.term_name ||
          'Semester 1 (Fall)',
        academic_year:
          editingAssignment?.academic_year ||
          initialValues?.academic_year ||
          '2026-2027',
        teacher_comments: teacherComments.trim() || null,
        resource_urls:
          editingAssignment?.resource_urls ?? ([] as unknown as Json),
        submission_files:
          editingAssignment?.submission_files ?? ([] as unknown as Json),
        state_standards: preservedStateStandards,
        updated_by: activeUserName,
        updated_at: nowIso,
      };

      if (editingAssignment) {
        const { data, error } = await supabase
          .from('assignments')
          .update(assignmentPayload)
          .eq('id', editingAssignment.id)
          .select('*')
          .single();

        if (error) {
          toast.error(`Failed to update assignment: ${error.message}`);
          return;
        }
        toast.success(
          isOverridingApi
            ? 'Assignment saved with Manual Grade Override (locked against future API pulls)'
            : 'Assignment saved'
        );
        if (onSaved && data) {
          onSaved(data as unknown as GradebookAssignment);
        }
        onClose();
      } else {
        const { data, error } = await supabase
          .from('assignments')
          .insert({
            ...assignmentPayload,
            created_by: activeUserName,
          })
          .select('*')
          .single();

        if (error) {
          toast.error(`Failed to create assignment: ${error.message}`);
          return;
        }
        toast.success('Assignment created');
        if (onSaved && data) {
          onSaved(data as unknown as GradebookAssignment);
        }
        onClose();
      }
    } catch {
      toast.error('Unexpected error saving assignment');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        bgcolor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: '100%',
          maxWidth: 660,
          maxHeight: '92vh',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <form
          onSubmit={handleSave}
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '92vh',
            overflow: 'hidden',
          }}
        >
          {/* HEADER */}
          <Box
            px={2.5}
            py={2}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.5,
                  bgcolor: alpha(
                    selectedTypeObj?.color || theme.palette.primary.main,
                    0.12
                  ),
                  color: selectedTypeObj?.color || theme.palette.primary.main,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {entryMode === 'recurring_template' ? (
                  <Repeat size={18} />
                ) : gradingMode === 'problems_calculator' ? (
                  <Calculator size={18} />
                ) : (
                  <FileText size={18} />
                )}
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                  {editingTemplate
                    ? 'Edit Recurring Assignment Rule'
                    : editingAssignment
                    ? 'Edit Assignment'
                    : entryMode === 'recurring_template'
                    ? 'New Recurring Assignment Rule'
                    : 'New Assignment'}
                </Typography>
                {activeSubject && (
                  <Typography variant="caption" color="text.secondary">
                    {activeSubject.name}
                  </Typography>
                )}
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              {!editingAssignment && !editingTemplate && (
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={entryMode}
                  onChange={(_, val) => {
                    if (val) setEntryMode(val);
                  }}
                >
                  <ToggleButton
                    value="single"
                    sx={{ textTransform: 'none', fontWeight: 600, px: 1.25 }}
                  >
                    Single Assignment
                  </ToggleButton>
                  <ToggleButton
                    value="recurring_template"
                    sx={{ textTransform: 'none', fontWeight: 600, px: 1.25 }}
                  >
                    Recurring Weekly Rule
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
              <IconButton size="small" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </Stack>
          </Box>

          {/* BODY */}
          <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
            <Stack spacing={2}>
              {/* 1. SUBJECT, CATEGORY & TITLE */}
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    SelectProps={{ native: true }}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                    label="Subject / Class"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    required
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    SelectProps={{ native: true }}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                    label="Type / Category"
                    value={categorySlug}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    {effectiveTypes.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label={
                      entryMode === 'recurring_template'
                        ? 'Title Template (supports {week}, {lesson}, {day}, {workbook})'
                        : 'Assignment Title'
                    }
                    placeholder={
                      entryMode === 'recurring_template'
                        ? 'e.g. Week {week} Spelling Test'
                        : 'e.g. Week 7 Spelling Test'
                    }
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </Grid>

                {entryMode === 'single' &&
                  subjectSyllabusActivities.length > 0 &&
                  (categorySlug === 'activity' || linkedSyllabusClassNum !== null) && (
                    <Grid item xs={12}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: alpha(theme.palette.success.main, 0.05),
                          borderColor: alpha(theme.palette.success.main, 0.3),
                        }}
                      >
                        <Stack spacing={1}>
                          <TextField
                            fullWidth
                            select
                            SelectProps={{ native: true }}
                            InputLabelProps={{ shrink: true }}
                            size="small"
                            label="Link to Syllabus Activity (Auto-Fills Same Weekday & Supplies)"
                            value={linkedSyllabusClassNum ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) {
                                setLinkedSyllabusClassNum(null);
                                return;
                              }
                              const clsNum = Number(val);
                              setLinkedSyllabusClassNum(clsNum);
                              const chosen = subjectSyllabusActivities.find(
                                (sa) => sa.classNumber === clsNum
                              );
                              if (chosen) {
                                setCategorySlug('activity');
                                setTitle(`Activity: ${chosen.activityName}`);
                                setAssignedDate(chosen.openDate);
                                setDueDate(chosen.dueDate);
                                if (chosen.supplies.length > 0) {
                                  setInstructions(
                                    `Supplies Needed: ${chosen.supplies.join(', ')}`
                                  );
                                }
                              }
                            }}
                          >
                            <option value="">-- Select a Syllabus Activity --</option>
                            {subjectSyllabusActivities.map((sa) => (
                              <option key={sa.classNumber} value={sa.classNumber}>
                                Week {sa.weekNumber}, Class {sa.classNumber} ({sa.weekdayLabel} — {sa.dueDate}): {sa.activityName}
                              </option>
                            ))}
                          </TextField>

                          {(() => {
                            const activeAct =
                              linkedSyllabusClassNum !== null
                                ? subjectSyllabusActivities.find(
                                    (sa) => sa.classNumber === linkedSyllabusClassNum
                                  )
                                : undefined;
                            const suppliesToShow =
                              activeAct?.supplies ||
                              editingMoodleMeta?.supplies ||
                              [];
                            if (suppliesToShow.length === 0) return null;
                            return (
                              <Box>
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  color="success.main"
                                  display="block"
                                  sx={{ mb: 0.5 }}
                                >
                                  Activity Supplies Needed{activeAct ? ` (${activeAct.weekdayLabel}, Class ${activeAct.classNumber})` : ''}:
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                  {suppliesToShow.map((sup, idx) => (
                                    <Chip
                                      key={`modal-sup-${idx}`}
                                      size="small"
                                      label={sup}
                                      color="success"
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            );
                          })()}
                        </Stack>
                      </Paper>
                    </Grid>
                  )}
              </Grid>

              {/* 2. OPEN & CLOSE DATES + STATUS (SINGLE ASSIGNMENT) OR SIMPLIFIED RECURRING RULE BUILDER */}
              {entryMode === 'single' ? (
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="Open / Assigned Date"
                      InputLabelProps={{ shrink: true }}
                      value={assignedDate}
                      onChange={(e) => setAssignedDate(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="Close / Due Date"
                      InputLabelProps={{ shrink: true }}
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                      label="Status"
                      value={workflowStatus}
                      onChange={(e) =>
                        setWorkflowStatus(e.target.value as WorkflowStatus)
                      }
                    >
                      <option value="not_started">Pending / Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="needs_grading">Needs Grading</option>
                      <option value="completed">Completed &amp; Graded</option>
                    </TextField>
                  </Grid>
                </Grid>
              ) : (
                /* SIMPLIFIED RECURRING SCHEDULE & WEEKLY PLANNER LINK BUILDER */
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                  }}
                >
                  {subjectWeeklyChecklistItems.length > 0 && (
                    <Box mb={2}>
                      <Typography
                        variant="caption"
                        fontWeight={800}
                        color="primary.main"
                        display="block"
                        mb={0.75}
                      >
                        1-Click Link to {activeSubject?.name} Weekly Planner Checklist Line:
                      </Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {subjectWeeklyChecklistItems.map((item, idx) => {
                          const isTestLine = /test|quiz/i.test(item.line);
                          return (
                            <Chip
                              key={`${item.dayKey}-${idx}`}
                              size="small"
                              icon={<Sparkles size={12} />}
                              label={`${item.dayLabel}: "${item.line}"`}
                              color={isTestLine ? 'primary' : 'default'}
                              variant={
                                recurringDays.includes(item.dayKey) && isTestLine
                                  ? 'filled'
                                  : 'outlined'
                              }
                              onClick={() => {
                                setRecurringDays([item.dayKey]);
                                setLinkedWeeklySource('weekly_template');
                                const cleanLine = item.line
                                  .replace(/^- \[[ xX]\]\s*/, '')
                                  .replace(/^•\s*/, '')
                                  .trim();
                                if (
                                  activeSubject?.name.toLowerCase().includes('spelling') &&
                                  /test/i.test(cleanLine)
                                ) {
                                  setTitle('Week {week} Spelling Test');
                                  setCategorySlug('spelling_test');
                                  setGradingMode('problems_calculator');
                                  setPointsPossible('20');
                                  setTotalProblems('20');
                                  setInstructions(
                                    `Weekly Spelling Test (18–20 words) linked to "${item.line}" on ${item.dayLabel}.`
                                  );
                                } else {
                                  setTitle(cleanLine);
                                  setInstructions(
                                    `Linked to "${item.line}" in ${activeSubject?.name} weekly planner.`
                                  );
                                }
                              }}
                              sx={{ fontWeight: 600, cursor: 'pointer' }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  )}

                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                    display="block"
                    mb={0.75}
                  >
                    Which Day(s) of the Week Is It Due on the Weekly Planner?
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" mb={1.75}>
                    {DAY_KEYS.map((dk) => {
                      const selected = recurringDays.includes(dk);
                      return (
                        <Chip
                          key={dk}
                          size="small"
                          label={DAY_LABELS[dk]}
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                          onClick={() => handleToggleRecurringDay(dk)}
                          sx={{ fontWeight: 600, cursor: 'pointer' }}
                        />
                      );
                    })}
                  </Stack>

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        select
                        SelectProps={{ native: true }}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                        label="Link to Weekly Sequence Counter"
                        value={linkedWeeklySource}
                        onChange={(e) =>
                          setLinkedWeeklySource(e.target.value as LinkedWeeklySource)
                        }
                      >
                        <option value="weekly_template">
                          Weekly Planner Rule (Follows Week {'{week}'} Counter)
                        </option>
                        <option value="math_workbook">
                          Math Syllabus Workbook (Follows Day {'{day}'})
                        </option>
                        <option value="syllabus_row">Course Syllabus Row</option>
                        <option value="attend_class">Class Attendance</option>
                        <option value="custom">Independent Recurring Assignment</option>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        select
                        SelectProps={{ native: true }}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                        label="When Saved, How Should It Populate?"
                        value={autoBehavior}
                        onChange={(e) =>
                          setAutoBehavior(e.target.value as AutoBehaviorMode)
                        }
                      >
                        <option value="auto_create">
                          Auto-Create Immediately in Planner &amp; Gradebook
                        </option>
                        <option value="queue_for_approval">
                          Send to Staging Approval Queue First
                        </option>
                        <option value="ignore">
                          Pause / Ignore (Do Not Auto-Create)
                        </option>
                      </TextField>
                    </Grid>
                  </Grid>

                  <Paper
                    variant="outlined"
                    sx={{
                      mt: 1.5,
                      p: 1.25,
                      borderRadius: 1.25,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Calendar size={15} color={theme.palette.primary.main} />
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                        <strong>How this works:</strong> Saving this rule automatically populates{' '}
                        <strong>
                          { (title || 'Week {week} Assignment').replace(/\{week\}/g, '7').replace(/\{day\}/g, '12') }
                        </strong>{' '}
                        onto your <strong>Weekly Planner</strong> ({recurringDays.map((d) => DAY_LABELS[d]).join(', ')}) and your{' '}
                        <strong>Gradebook</strong> across all school weeks. If you skip or double up a week in the Weekly Planner, the{' '}
                        <code>{'{week}'}</code> number automatically shifts with it!
                      </Typography>
                    </Stack>
                  </Paper>
                </Paper>
              )}

              {/* 3. GRADE / SCORE CARD (LOCKED WITH WARNING BANNER IF API-SYNCED ASSIGNMENT) */}
              {entryMode === 'single' &&
              isEditingApiAssignment &&
              !apiOverrideUnlocked &&
              !editingMoodleMeta?.manual_override ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.error.main, 0.06),
                    borderColor: 'error.main',
                    borderWidth: 2,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <ShieldAlert
                      size={24}
                      color={theme.palette.error.main}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={800} color="error.main">
                        API-Synced Grade (Locked Against Accidental Edits)
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        This grade is imported automatically from the Memoria Academy API and shouldn&apos;t be changed manually.
                        If you really need to override it, click below to unlock manual override mode.
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        startIcon={<Unlock size={14} />}
                        onClick={() => setApiOverrideUnlocked(true)}
                        sx={{ mt: 1.25, fontWeight: 800, textTransform: 'none' }}
                      >
                        Continue to Manual Grade Override
                      </Button>
                    </Box>
                  </Stack>
                </Paper>
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 1.5,
                    bgcolor: isGraded
                      ? alpha(theme.palette.success.main, 0.025)
                      : 'action.hover',
                    borderColor: isGraded
                      ? alpha(theme.palette.success.main, 0.25)
                      : 'divider',
                  }}
                >
                  {isEditingApiAssignment && (
                    <Box
                      sx={{
                        mb: 1.5,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.warning.main, 0.14),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 1,
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={800}
                        color={theme.palette.mode === 'dark' ? 'warning.light' : 'warning.dark'}
                      >
                        ⚠️ Manual Override Mode Active — Saving will lock this grade against future API pulls.
                      </Typography>
                      {editingAssignment && (
                        <Stack direction="row" spacing={0.75}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="info"
                            onClick={async () => {
                              const reverted = await revertApiAssignmentOverride(
                                editingAssignment,
                                'original_api'
                              );
                              if (reverted && onSaved) {
                                onSaved(reverted);
                                onClose();
                              }
                            }}
                            sx={{ fontSize: '0.68rem', py: 0.2, textTransform: 'none', fontWeight: 700 }}
                          >
                            Revert to API Value
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            onClick={async () => {
                              const reverted = await revertApiAssignmentOverride(
                                editingAssignment,
                                'blank'
                              );
                              if (reverted && onSaved) {
                                onSaved(reverted);
                                onClose();
                              }
                            }}
                            sx={{ fontSize: '0.68rem', py: 0.2, textTransform: 'none', fontWeight: 700 }}
                          >
                            Revert to Blank
                          </Button>
                        </Stack>
                      )}
                    </Box>
                  )}

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    flexWrap="wrap"
                    gap={1}
                    mb={isGraded ? 1.5 : 0}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            color="success"
                            checked={isGraded}
                            onChange={(e) => setIsGraded(e.target.checked)}
                          />
                        }
                        label={
                          <Typography variant="body2" fontWeight={700}>
                            {isGraded ? 'Graded Assignment' : 'Ungraded (Checklist Only)'}
                          </Typography>
                        }
                      />
                      {isGraded && entryMode === 'single' && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={isExempt}
                              onChange={(e) => setIsExempt(e.target.checked)}
                            />
                          }
                          label={
                            <Typography variant="caption" fontWeight={600}>
                              Exempt
                            </Typography>
                          }
                        />
                      )}
                    </Stack>

                    {isGraded && (
                      <TextField
                        select
                        SelectProps={{ native: true }}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                        label="Scoring Method"
                        value={gradingMode}
                        onChange={(e) =>
                          setGradingMode(e.target.value as ScoringMode)
                        }
                        sx={{ minWidth: 210 }}
                      >
                        <option value="points">Points (Earned / Possible)</option>
                        <option value="problems_calculator">
                          Problems / Words (Total / Missed)
                        </option>
                        <option value="percentage">Percentage (0–100%)</option>
                        <option value="completion">Completion (100%)</option>
                      </TextField>
                    )}
                  </Stack>

                  {isGraded && (
                    <>
                      {gradingMode === 'problems_calculator' && (
                        <Grid container spacing={1.5} alignItems="center">
                          <Grid item xs={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label={
                                categorySlug === 'spelling_test'
                                  ? 'Total Words (18–20)'
                                  : entryMode === 'recurring_template'
                                  ? 'Default Total Problems'
                                  : 'Total Problems'
                              }
                              placeholder={categorySlug === 'spelling_test' ? '20' : '25'}
                              InputLabelProps={{ shrink: true }}
                              value={totalProblems}
                              onChange={(e) => setTotalProblems(e.target.value)}
                              inputProps={{ min: 1 }}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label={
                                categorySlug === 'spelling_test'
                                  ? 'Missed Words'
                                  : 'Missed Problems'
                              }
                              InputLabelProps={{ shrink: true }}
                              disabled={entryMode === 'recurring_template'}
                              value={missedProblems}
                              onChange={(e) => setMissedProblems(e.target.value)}
                              inputProps={{ min: 0 }}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1,
                                textAlign: 'center',
                                borderRadius: 1.25,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                              >
                                Grade
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight={700}
                                color={
                                  liveMetrics.is_scored
                                    ? 'success.main'
                                    : 'text.secondary'
                                }
                              >
                                {liveMetrics.is_scored
                                  ? formatClassGradeDisplay(
                                      liveMetrics.percentage_score,
                                      liveMetrics.letter_grade || '',
                                      activeSubjectPolicy
                                    )
                                  : entryMode === 'recurring_template'
                                  ? 'Graded Weekly'
                                  : 'Ungraded'}
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      )}

                      {gradingMode === 'points' && (
                        <Grid container spacing={1.5} alignItems="center">
                          <Grid item xs={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Points Earned"
                              placeholder="Score"
                              InputLabelProps={{ shrink: true }}
                              disabled={entryMode === 'recurring_template'}
                              value={pointsEarned}
                              onChange={(e) => setPointsEarned(e.target.value)}
                              inputProps={{ step: '0.01' }}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Points Possible"
                              InputLabelProps={{ shrink: true }}
                              value={pointsPossible}
                              onChange={(e) => setPointsPossible(e.target.value)}
                              inputProps={{ min: 1, step: '0.5' }}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1,
                                textAlign: 'center',
                                borderRadius: 1.25,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                              >
                                Grade
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight={700}
                                color={
                                  liveMetrics.is_scored
                                    ? 'success.main'
                                    : 'text.secondary'
                                }
                              >
                                {liveMetrics.is_scored
                                  ? formatClassGradeDisplay(
                                      liveMetrics.percentage_score,
                                      liveMetrics.letter_grade || '',
                                      activeSubjectPolicy
                                    )
                                  : 'Ungraded'}
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      )}

                      {gradingMode === 'percentage' && (
                        <Grid container spacing={1.5} alignItems="center">
                          <Grid item xs={6}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              label="Percentage Score (%)"
                              InputLabelProps={{ shrink: true }}
                              disabled={entryMode === 'recurring_template'}
                              value={percentageInput}
                              onChange={(e) => setPercentageInput(e.target.value)}
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">%</InputAdornment>
                                ),
                              }}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1,
                                textAlign: 'center',
                                borderRadius: 1.25,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                              >
                                Grade
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight={700}
                                color="success.main"
                              >
                                {formatClassGradeDisplay(
                                  liveMetrics.percentage_score,
                                  liveMetrics.letter_grade || '',
                                  activeSubjectPolicy
                                )}
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      )}

                      {(gradingMode === 'completion' ||
                        gradingMode === 'pass_fail') && (
                        <Button
                          variant={
                            workflowStatus === 'completed'
                              ? 'contained'
                              : 'outlined'
                          }
                          color="success"
                          size="small"
                          startIcon={<CheckCircle2 size={15} />}
                          onClick={() => {
                            setWorkflowStatus('completed');
                            setPointsEarned(pointsPossible);
                          }}
                          sx={{ fontWeight: 600, textTransform: 'none' }}
                        >
                          Mark Completed (100%)
                        </Button>
                      )}
                    </>
                  )}
                </Paper>
              )}

              {/* 4. INSTRUCTIONS & FEEDBACK */}
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={entryMode === 'single' ? 6 : 12}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    label="Assignment Notes / Instructions"
                    placeholder="Optional lesson details or instructions..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </Grid>
                {entryMode === 'single' && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      label="Teacher Feedback / Comments"
                      placeholder="Optional grading feedback..."
                      value={teacherComments}
                      onChange={(e) => setTeacherComments(e.target.value)}
                    />
                  </Grid>
                )}
              </Grid>
            </Stack>
          </Box>

          {/* FOOTER */}
          <Box
            px={2.5}
            py={1.75}
            sx={{
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 1.25,
            }}
          >
            <Button
              onClick={onClose}
              color="inherit"
              sx={{ fontWeight: 600, textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={saving}
              startIcon={
                saving ? <CircularProgress size={15} /> : <Save size={15} />
              }
              sx={{ fontWeight: 600, px: 2.5, textTransform: 'none' }}
            >
              {saving
                ? 'Saving...'
                : entryMode === 'recurring_template'
                ? 'Save Rule & Populate Planner'
                : 'Save Changes'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
