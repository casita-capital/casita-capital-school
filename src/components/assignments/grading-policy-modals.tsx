'use client';

import React, { useEffect, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Award,
  BookOpen,
  Calculator,
  Edit3,
  Layers,
  Plus,
  Save,
  Settings,
  Sliders,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import {
  AssignmentTypeConfig,
  AutoBehaviorMode,
  BROADER_DISCIPLINES,
  CalculationBasis,
  CourseLevel,
  CreditCalculationMode,
  DEFAULT_ASSIGNMENT_TYPES,
  GradeDisplayMode,
  parseSubjectGradingPolicy,
  ParticipationScope,
  ScoringMode,
  SubjectGradingPolicy,
  SubjectWithGrading,
  WeightingMode,
} from 'src/utils/gradebook-calculator';

// ============================================================================
// 1. ASSIGNMENT TYPES & DEFINITIONS MANAGER MODAL
// ============================================================================

interface AssignmentTypesManagerModalProps {
  open: boolean;
  onClose: () => void;
  assignmentTypes: AssignmentTypeConfig[];
  onUpdated: (nextTypes: AssignmentTypeConfig[]) => void;
}

export function AssignmentTypesManagerModal({
  open,
  onClose,
  assignmentTypes,
  onUpdated,
}: AssignmentTypesManagerModalProps) {
  const theme = useTheme();
  const supabase = createClient();

  const [typesList, setTypesList] = useState<AssignmentTypeConfig[]>(assignmentTypes);
  const [editingType, setEditingType] = useState<AssignmentTypeConfig | null>(null);
  const [isNew, setIsNew] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setTypesList(
        assignmentTypes.length > 0 ? assignmentTypes : DEFAULT_ASSIGNMENT_TYPES
      );
      setEditingType(null);
      setIsNew(false);
    }
  }, [open, assignmentTypes]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleStartAdd = () => {
    setIsNew(true);
    setEditingType({
      id: '',
      name: '',
      slug: '',
      description: '',
      scoring_mode: 'points',
      default_points: 100,
      default_weight: 20,
      color: '#1b5698',
      icon: 'FileText',
      is_graded_by_default: true,
      sort_order: typesList.length + 1,
    });
  };

  const handleSaveType = async () => {
    if (!editingType || !editingType.name.trim()) {
      toast.error('Please enter an Assignment Type name');
      return;
    }

    const generatedSlug =
      editingType.slug.trim() ||
      editingType.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

    setSaving(true);
    try {
      const payload = {
        name: editingType.name.trim(),
        slug: generatedSlug,
        description: editingType.description.trim(),
        scoring_mode: editingType.scoring_mode,
        default_points: Number(editingType.default_points) || 100,
        default_weight: Number(editingType.default_weight) || 20,
        color: editingType.color || '#1b5698',
        icon: editingType.icon || 'FileText',
        is_graded_by_default: editingType.is_graded_by_default,
        sort_order: editingType.sort_order || typesList.length + 1,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('assignment_types')
        .upsert(payload, { onConflict: 'slug' })
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to save assignment type: ${error.message}`);
        return;
      }

      if (data) {
        const saved = data as unknown as AssignmentTypeConfig;
        const next = isNew
          ? [...typesList.filter((t) => t.slug !== saved.slug), saved]
          : typesList.map((t) => (t.slug === saved.slug || t.id === saved.id ? saved : t));
        setTypesList(next);
        onUpdated(next);
        setEditingType(null);
        setIsNew(false);
        toast.success(`Saved "${saved.name}" assignment type!`);
      }
    } catch {
      toast.error('Error saving assignment type');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = async (item: AssignmentTypeConfig) => {
    try {
      const { error } = await supabase
        .from('assignment_types')
        .delete()
        .eq('slug', item.slug);
      if (error) {
        toast.error(`Could not delete type: ${error.message}`);
        return;
      }
      const next = typesList.filter((t) => t.slug !== item.slug);
      setTypesList(next);
      onUpdated(next);
      toast.success(`Deleted "${item.name}"`);
    } catch {
      toast.error('Error deleting assignment type');
    }
  };

  if (!open) return null;

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label="Assignment Types and Definitions"
      onClick={onClose}
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
          maxWidth: 920,
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
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Layers size={20} color={theme.palette.primary.main} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Assignment Types &amp; Definitions
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Define what each assignment category means, its default scoring calculator, and default points/weight.
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={handleStartAdd}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
          >
            New Assignment Type
          </Button>
        </Box>

        <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
          {editingType && (
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              borderColor: alpha(theme.palette.primary.main, 0.3),
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} color="primary.main" mb={2}>
              {isNew ? 'Create New Assignment Type' : `Edit "${editingType.name}" Definition`}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Type Name"
                  placeholder="e.g. Math Problem Set, Spelling Test, Lab Report"
                  value={editingType.name}
                  onChange={(e) =>
                    setEditingType({ ...editingType, name: e.target.value })
                  }
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  select
                  SelectProps={{ native: true }}
                  size="small"
                  label="Default Scoring Calculator"
                  value={editingType.scoring_mode}
                  onChange={(e) =>
                    setEditingType({
                      ...editingType,
                      scoring_mode: e.target.value as ScoringMode,
                    })
                  }
                >
                  <option value="problems_calculator">
                    Total vs. Missed Problems (% Correct)
                  </option>
                  <option value="points">Standard Points (Earned / Possible)</option>
                  <option value="percentage">Direct Percentage (0–100%)</option>
                  <option value="completion">Completion-Based (100%)</option>
                  <option value="pass_fail">Pass / Fail</option>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    type="color"
                    label="Color"
                    value={editingType.color}
                    onChange={(e) =>
                      setEditingType({ ...editingType, color: e.target.value })
                    }
                    sx={{ width: 90 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Default Pts"
                    value={editingType.default_points}
                    onChange={(e) =>
                      setEditingType({
                        ...editingType,
                        default_points: Number(e.target.value) || 100,
                      })
                    }
                  />
                </Stack>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  label="Definition / What This Assignment Type Means & How It Is Graded"
                  placeholder="Explain what counts under this assignment type, rubric expectations, or grading guidelines..."
                  value={editingType.description}
                  onChange={(e) =>
                    setEditingType({ ...editingType, description: e.target.value })
                  }
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Default Category Weight (%)"
                  value={editingType.default_weight}
                  onChange={(e) =>
                    setEditingType({
                      ...editingType,
                      default_weight: Number(e.target.value) || 20,
                    })
                  }
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={8} display="flex" alignItems="center" justifyContent="space-between">
                <FormControlLabel
                  control={
                    <Switch
                      checked={editingType.is_graded_by_default}
                      onChange={(e) =>
                        setEditingType({
                          ...editingType,
                          is_graded_by_default: e.target.checked,
                        })
                      }
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={700}>
                      Graded in Gradebook by Default
                    </Typography>
                  }
                />

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => {
                      setEditingType(null);
                      setIsNew(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={saving}
                    startIcon={<Save size={15} />}
                    onClick={handleSaveType}
                    sx={{ fontWeight: 700, borderRadius: 1 }}
                  >
                    {saving ? 'Saving...' : 'Save Type'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Table size="small">
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>ASSIGNMENT TYPE</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>DEFINITION / MEANING</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>SCORING METHOD</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>DEFAULT PTS / WT</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                ACTIONS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {typesList.map((t) => (
              <TableRow key={t.slug} hover>
                <TableCell sx={{ width: 190, whiteSpace: 'nowrap' }}>
                  <Chip
                    label={t.name}
                    size="small"
                    sx={{
                      bgcolor: alpha(t.color, 0.14),
                      color: t.color,
                      border: `1px solid ${alpha(t.color, 0.3)}`,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {t.description || 'No description provided.'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ width: 170, whiteSpace: 'nowrap' }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      t.scoring_mode === 'problems_calculator'
                        ? 'Total / Missed Problems %'
                        : t.scoring_mode === 'points'
                        ? 'Points (Earned/Possible)'
                        : t.scoring_mode === 'percentage'
                        ? 'Percentage (%)'
                        : t.scoring_mode === 'completion'
                        ? 'Completion (100%)'
                        : 'Pass / Fail'
                    }
                    sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                  />
                </TableCell>
                <TableCell sx={{ width: 130, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  <Typography variant="caption" fontWeight={700}>
                    {t.default_points} pts · {t.default_weight}%
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ width: 100, whiteSpace: 'nowrap' }}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => {
                        setIsNew(false);
                        setEditingType(t);
                      }}
                    >
                      <Edit3 size={15} />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => handleDeleteType(t)}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </Box>

        <Box
          px={3}
          py={2}
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={onClose} variant="outlined" sx={{ fontWeight: 700, borderRadius: 1 }}>
            Done
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

// ============================================================================
// 2. PER-SUBJECT / PER-CLASS GRADING POLICY MODAL
// ============================================================================

interface ClassGradingPolicyModalProps {
  open: boolean;
  onClose: () => void;
  subjects: SubjectWithGrading[];
  initialSubjectId?: string;
  assignmentTypes: AssignmentTypeConfig[];
  onSaved: (updatedSubject: SubjectWithGrading) => void;
}

export function ClassGradingPolicyModal({
  open,
  onClose,
  subjects,
  initialSubjectId,
  assignmentTypes,
  onSaved,
}: ClassGradingPolicyModalProps) {
  const theme = useTheme();
  const supabase = createClient();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [policy, setPolicy] = useState<SubjectGradingPolicy | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const effectiveTypes =
    assignmentTypes.length > 0 ? assignmentTypes : DEFAULT_ASSIGNMENT_TYPES;

  useEffect(() => {
    if (!open || subjects.length === 0) return;
    const targetId =
      initialSubjectId && subjects.some((s) => s.id === initialSubjectId)
        ? initialSubjectId
        : subjects[0].id;
    setSelectedSubjectId(targetId);
    const sub = subjects.find((s) => s.id === targetId) || subjects[0];
    setPolicy(parseSubjectGradingPolicy(sub));
  }, [open, initialSubjectId, subjects]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleSelectSubject = (nextId: string) => {
    setSelectedSubjectId(nextId);
    const sub = subjects.find((s) => s.id === nextId);
    if (sub) {
      setPolicy(parseSubjectGradingPolicy(sub));
    }
  };

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || null;

  const handleUpdateCategoryWeight = (
    slug: string,
    patch: Partial<{ weight: number; drop_lowest: number; enabled: boolean }>
  ) => {
    if (!policy) return;
    const existing = policy.category_weights[slug] || {
      weight: 20,
      drop_lowest: 0,
      enabled: true,
    };
    setPolicy({
      ...policy,
      category_weights: {
        ...policy.category_weights,
        [slug]: {
          ...existing,
          ...patch,
        },
      },
    });
  };

  const handleSavePolicy = async () => {
    if (!currentSubject || !policy) return;
    setSaving(true);
    try {
      const updatePayload = {
        broader_discipline: policy.broader_discipline,
        course_code: policy.course_code,
        course_level: policy.course_level,
        grade_display_mode: policy.grade_display_mode,
        calculation_basis: policy.calculation_basis,
        preset_total_points: policy.preset_total_points,
        weighting_mode: policy.weighting_mode,
        participation_enabled: policy.participation_enabled,
        participation_scope: policy.participation_scope,
        participation_auto_behavior: policy.participation_auto_behavior,
        participation_points: policy.participation_points,
        credit_calculation_mode: policy.credit_calculation_mode,
        preset_credits: policy.preset_credits,
        grading_config: JSON.parse(JSON.stringify(policy)) as Json,
      };

      const { data, error } = await supabase
        .from('subjects')
        .update(updatePayload)
        .eq('id', currentSubject.id)
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to save grading policy: ${error.message}`);
        return;
      }

      if (data) {
        toast.success(`Saved class grading policy for ${currentSubject.name}`);
        onSaved(data as unknown as SubjectWithGrading);
        onClose();
      }
    } catch {
      toast.error('Unexpected error saving class grading policy');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !policy || !currentSubject) return null;

  const totalEnabledWeight = effectiveTypes.reduce((sum, t) => {
    const rule = policy.category_weights[t.slug];
    if (rule && !rule.enabled) return sum;
    return sum + (rule?.weight ?? t.default_weight);
  }, 0);

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label={`Class Structure and Grading Setup for ${currentSubject.name}`}
      onClick={onClose}
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
          maxWidth: 880,
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
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: currentSubject.color || theme.palette.primary.main,
              }}
            />
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.01em' }}>
                Class Structure &amp; Grading Setup — {currentSubject.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Choose how grades are displayed and calculated, and whether participation is tracked for this class.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              SelectProps={{ native: true }}
              size="small"
              label="Switch Class"
              value={selectedSubjectId}
              onChange={(e) => handleSelectSubject(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </TextField>
            <IconButton size="small" aria-label="Close grading policy modal" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
          <Stack spacing={2.5}>
            {/* SECTION 1: HOW GRADES ARE DETERMINED FOR THIS CLASS */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={2}>
                1. Grade Display &amp; Calculation Basis
              </Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Grade Display Format"
                    value={policy.grade_display_mode}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        grade_display_mode: e.target.value as GradeDisplayMode,
                      })
                    }
                    helperText="Show number %, letter grade, or both."
                  >
                    <option value="number_and_letter">
                      Number + Letter Grade (e.g. 94.5% A)
                    </option>
                    <option value="number_only">
                      Number / Percentage Only (e.g. 94.5%)
                    </option>
                    <option value="letter_only">Letter Grade Only (e.g. A)</option>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Points Calculation Basis"
                    value={policy.calculation_basis}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        calculation_basis: e.target.value as CalculationBasis,
                      })
                    }
                    helperText="Ratio of entered work vs. preset pool."
                  >
                    <option value="running_ratio">
                      Running Ratio (Earned vs. Entered So Far)
                    </option>
                    <option value="preset_total_points">
                      Preset Total Points Available in Class
                    </option>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={4}>
                  {policy.calculation_basis === 'preset_total_points' ? (
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Preset Total Points Available"
                      value={policy.preset_total_points}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          preset_total_points: Math.max(1, Number(e.target.value) || 1000),
                        })
                      }
                      helperText="Total points pool for the semester/course"
                      InputProps={{
                        endAdornment: <InputAdornment position="end">pts</InputAdornment>,
                      }}
                    />
                  ) : (
                    <TextField
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      size="small"
                      label="Weighting Method"
                      value={policy.weighting_mode}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          weighting_mode: e.target.value as WeightingMode,
                        })
                      }
                      helperText="Raw points vs. weighted categories."
                    >
                      <option value="raw_points">
                        Unweighted Raw Points (Earned / Possible)
                      </option>
                      <option value="category_weighted">
                        Weighted by Assignment Category (%)
                      </option>
                    </TextField>
                  )}
                </Grid>
              </Grid>
            </Paper>

            {/* SECTION 1B: INTERNAL GRADE VISIBILITY FOR API-SYNCED CLASSES */}
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor:
                  policy.show_internal_grade_on_gradebook !== false
                    ? alpha(theme.palette.secondary.main, 0.04)
                    : 'background.paper',
                borderColor:
                  policy.show_internal_grade_on_gradebook !== false
                    ? alpha(theme.palette.secondary.main, 0.3)
                    : 'divider',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Show Internal / Home Grade on Gradebook & Report Card
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    For API-synced classes, displays the independent home/internal grade (e.g., graded exercises or memory work not in Moodle) alongside the official API grade. Toggle off to hide internal grades on the Gradebook and Report Card.
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={policy.show_internal_grade_on_gradebook !== false}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          show_internal_grade_on_gradebook: e.target.checked,
                        })
                      }
                      color="secondary"
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={700}>
                      {policy.show_internal_grade_on_gradebook !== false ? 'Shown' : 'Hidden'}
                    </Typography>
                  }
                />
              </Stack>
            </Paper>

            {/* SECTION 2: PARTICIPATION GRADING CONFIGURATION (SCOPED TO THIS CLASS) */}
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor: policy.participation_enabled
                  ? alpha(theme.palette.success.main, 0.03)
                  : 'background.paper',
                borderColor: policy.participation_enabled
                  ? alpha(theme.palette.success.main, 0.3)
                  : 'divider',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                mb={policy.participation_enabled ? 2 : 0}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} display="flex" alignItems="center" gap={1}>
                    <Users size={16} color={theme.palette.success.main} />
                    2. Class Participation Grading
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Toggle participation grades on or off for {currentSubject.name} and choose how often they attach.
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      color="success"
                      checked={policy.participation_enabled}
                      onChange={(e) =>
                        setPolicy({ ...policy, participation_enabled: e.target.checked })
                      }
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={700}>
                      {policy.participation_enabled ? 'Enabled' : 'Disabled'}
                    </Typography>
                  }
                />
              </Stack>

              {policy.participation_enabled && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      size="small"
                      label="How Participation Is Attached"
                      value={policy.participation_scope}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          participation_scope: e.target.value as ParticipationScope,
                        })
                      }
                    >
                      <option value="per_class_event">
                        Each Class Event (Live / In-Person)
                      </option>
                      <option value="per_week">
                        Each Week of Class (Weekly Score)
                      </option>
                      <option value="per_module">
                        Each Curriculum Module / Unit
                      </option>
                      <option value="per_semester">
                        Each Semester / Term
                      </option>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      size="small"
                      label="Auto-Population Behavior"
                      value={policy.participation_auto_behavior}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          participation_auto_behavior: e.target.value as AutoBehaviorMode,
                        })
                      }
                    >
                      <option value="auto_create">Auto-Create Active Grade Item</option>
                      <option value="queue_for_approval">Queue for Approval (Staging)</option>
                      <option value="ignore">Ignore (Enter Manually Only)</option>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Points per Entry"
                      value={policy.participation_points}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          participation_points: Math.max(1, Number(e.target.value) || 10),
                        })
                      }
                      InputProps={{
                        endAdornment: <InputAdornment position="end">pts</InputAdornment>,
                      }}
                    />
                  </Grid>
                </Grid>
              )}
            </Paper>

            {/* SECTION 3: CATEGORY WEIGHTS & DROP LOWEST SCORES */}
            {policy.weighting_mode === 'category_weighted' &&
              policy.calculation_basis === 'running_ratio' && (
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        3. Category Weights &amp; Drop-Lowest Rules
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Categories with no entered assignments normalize automatically.
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={totalEnabledWeight === 100 ? 'success' : 'primary'}
                      variant="outlined"
                      label={`Active Weight Sum: ${totalEnabledWeight}%`}
                      sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </Stack>

                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>USE</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>CATEGORY</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 150 }}>WEIGHT (%)</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 160 }}>DROP LOWEST N</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {effectiveTypes.map((t) => {
                        const rule = policy.category_weights[t.slug] || {
                          weight: t.default_weight,
                          drop_lowest: 0,
                          enabled: true,
                        };
                        return (
                          <TableRow key={t.slug}>
                            <TableCell sx={{ width: 60 }}>
                              <Checkbox
                                size="small"
                                checked={rule.enabled}
                                onChange={(e) =>
                                  handleUpdateCategoryWeight(t.slug, {
                                    enabled: e.target.checked,
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: t.color,
                                  }}
                                />
                                <Typography variant="body2" fontWeight={600}>
                                  {t.name}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                disabled={!rule.enabled}
                                value={rule.weight}
                                onChange={(e) =>
                                  handleUpdateCategoryWeight(t.slug, {
                                    weight: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                InputProps={{
                                  endAdornment: (
                                    <InputAdornment position="end">%</InputAdornment>
                                  ),
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                disabled={!rule.enabled}
                                value={rule.drop_lowest}
                                onChange={(e) =>
                                  handleUpdateCategoryWeight(t.slug, {
                                    drop_lowest: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                inputProps={{ min: 0, max: 5 }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Paper>
              )}

            {/* SECTION 4: TRANSCRIPT & CARNEGIE CREDIT METADATA */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={2}>
                {policy.weighting_mode === 'category_weighted' &&
                policy.calculation_basis === 'running_ratio'
                  ? '4. Transcript & Credit Settings'
                  : '3. Transcript & Credit Settings'}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Subject Discipline"
                    value={policy.broader_discipline}
                    onChange={(e) =>
                      setPolicy({ ...policy, broader_discipline: e.target.value })
                    }
                  >
                    {BROADER_DISCIPLINES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Transcript Course Code"
                    value={policy.course_code}
                    onChange={(e) =>
                      setPolicy({ ...policy, course_code: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField
                    fullWidth
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Course GPA Weighting"
                    value={policy.course_level}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        course_level: e.target.value as CourseLevel,
                      })
                    }
                  >
                    <option value="standard">Standard (4.0 Max GPA)</option>
                    <option value="honors">Honors (+0.5 GPA Weight)</option>
                    <option value="ap">AP (+1.0 GPA Weight)</option>
                    <option value="dual_enrollment">Dual Enrollment (+1.0 GPA Weight)</option>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Credit Calculation Method"
                    value={policy.credit_calculation_mode}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        credit_calculation_mode: e.target.value as CreditCalculationMode,
                      })
                    }
                  >
                    <option value="fixed_preset">
                      Preset Course Credit (1.0 Full Year / 0.5 Semester)
                    </option>
                    <option value="carnegie_hours">
                      Automated Carnegie Unit (120 Instructional Hours = 1.0 Credit)
                    </option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Preset Course Credits"
                    value={String(policy.preset_credits)}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        preset_credits: Number(e.target.value) || 1.0,
                      })
                    }
                  >
                    <option value="0.5">0.5 Credits (Semester / Elective)</option>
                    <option value="1">1.0 Credit (Full Academic Year / Lab Science)</option>
                    <option value="1.5">1.5 Credits (Extended Lab Course)</option>
                  </TextField>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        </Box>

        <Box
          px={3}
          py={2}
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
          }}
        >
          <Button onClick={onClose} color="inherit" sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <Save size={16} />}
            onClick={handleSavePolicy}
            sx={{ fontWeight: 700, px: 2.5 }}
          >
            {saving ? 'Saving Policy...' : `Save ${currentSubject.name} Policy`}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
