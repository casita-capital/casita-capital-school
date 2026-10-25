'use client';

import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ArrowDown,
  ArrowUp,
  Award,
  CheckSquare,
  Code,
  CornerDownRight,
  FileText,
  Heading,
  Info,
  Layers,
  Minus,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  AssignmentTypeConfig,
  DEFAULT_ASSIGNMENT_TYPES,
  ScoringMode,
} from 'src/utils/gradebook-calculator';
import { DAY_KEYS, DAY_LABELS, DayKey } from 'src/utils/recurring-planner';
import {
  formatRepeatDaysShortLabel,
  InfoSubType,
  normalizeWeeklyBlockKey,
  StructuredCellLineItem,
  StructuredSubItem,
  WeeklyItemCategory,
} from 'src/utils/weekly-grading-items';

type VisualBlockRole = 'header' | 'info' | 'verified' | 'graded';

function getVisualBlockRole(item: StructuredCellLineItem): VisualBlockRole {
  if (
    item.category === 'info' &&
    (item.infoSubType === 'header' || item.infoSubType === 'divider')
  ) {
    return 'header';
  }
  return item.category;
}

const SHORT_DAY_PILLS: Array<{ key: DayKey; label: string }> = [
  { key: 'monday', label: 'M' },
  { key: 'tuesday', label: 'T' },
  { key: 'wednesday', label: 'W' },
  { key: 'thursday', label: 'Th' },
  { key: 'friday', label: 'F' },
];

const QUICK_TOKENS: Array<{ token: string; label: string }> = [
  { token: '{week}', label: '+ {week}' },
  { token: '{class_num}', label: '+ {class_num}' },
  { token: '{lesson}', label: '+ {lesson}' },
  { token: '{prev_lesson}', label: '+ {prev_lesson}' },
  { token: '{topic}', label: '+ {topic}' },
  { token: '{activity}', label: '+ {activity}' },
];

export interface StructuredTemplateBlocksEditorProps {
  subjectId: string;
  dayKey: DayKey;
  subjectColor?: string;
  items: StructuredCellLineItem[];
  onChangeItems: (nextItems: StructuredCellLineItem[]) => void;
  rawTextValue?: string;
  onChangeRawText?: (nextRaw: string) => void;
  assignmentTypes?: AssignmentTypeConfig[];
  allowGradedBlocks?: boolean;
  allowRepeatAcrossWeek?: boolean;
  showVariableTokens?: boolean;
  emptyPrompt?: string;
}

export const StructuredTemplateBlocksEditor: React.FC<
  StructuredTemplateBlocksEditorProps
> = ({
  subjectId,
  dayKey,
  subjectColor = '#2563eb',
  items,
  onChangeItems,
  rawTextValue = '',
  onChangeRawText,
  assignmentTypes = DEFAULT_ASSIGNMENT_TYPES,
  allowGradedBlocks = true,
  allowRepeatAcrossWeek = true,
  showVariableTokens = true,
  emptyPrompt = 'No blocks configured for this day yet. Add a Header, Info item, Verified checklist item, or Graded Assignment below.',
}) => {
  const theme = useTheme();
  const [rawMode, setRawMode] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  const effectiveTypes =
    assignmentTypes.length > 0 ? assignmentTypes : DEFAULT_ASSIGNMENT_TYPES;

  const handleAddBlock = (role: VisualBlockRole, subTypeOverride?: InfoSubType) => {
    const newId = `tpl-block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const defaultType =
      effectiveTypes.find((t) => t.slug === 'homework') || effectiveTypes[0];

    const category: WeeklyItemCategory =
      role === 'header' ? 'info' : role;
    const infoSubType: InfoSubType =
      role === 'header'
        ? subTypeOverride || 'header'
        : subTypeOverride || 'bullet';

    const newItem: StructuredCellLineItem = {
      id: newId,
      subjectId,
      dateStr: '2026-10-19',
      dayKey,
      weekdayLabel: DAY_LABELS[dayKey],
      category,
      text:
        role === 'header' && infoSubType === 'divider'
          ? 'Section Divider'
          : role === 'header'
          ? 'Complete the following:'
          : '',
      infoSubType,
      checked: false,
      subItems: [],
      repeatAcrossWeek: false,
      repeatDays: [dayKey],
      weeklyGroupKey: '',
      assignmentCategory: defaultType?.slug || 'homework',
      scoringMode:
        role === 'graded'
          ? defaultType?.scoring_mode || 'points'
          : 'points',
      pointsEarned: null,
      pointsPossible: defaultType?.default_points || 100,
      totalProblems:
        defaultType?.scoring_mode === 'problems_calculator' ? 20 : null,
      problemsMissed: null,
      percentageScore: null,
      letterGrade: null,
      isApiSynced: false,
    };

    onChangeItems([...items, newItem]);
    setFocusedBlockId(newId);
  };

  const handleUpdateBlock = (
    id: string,
    patch: Partial<StructuredCellLineItem>
  ) => {
    onChangeItems(
      items.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, ...patch };
        if (patch.text !== undefined && !it.repeatAcrossWeek) {
          updated.weeklyGroupKey = normalizeWeeklyBlockKey(patch.text);
        }
        return updated;
      })
    );
  };

  const handleDeleteBlock = (id: string) => {
    onChangeItems(items.filter((it) => it.id !== id));
  };

  const handleMoveBlock = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    onChangeItems(copy);
  };

  const handleRoleChange = (item: StructuredCellLineItem, nextRole: VisualBlockRole) => {
    if (nextRole === 'header') {
      handleUpdateBlock(item.id, {
        category: 'info',
        infoSubType: item.infoSubType === 'divider' ? 'divider' : 'header',
        repeatAcrossWeek: false,
      });
      return;
    }

    if (nextRole === 'info') {
      handleUpdateBlock(item.id, {
        category: 'info',
        infoSubType: item.infoSubType === 'parent_note' ? 'parent_note' : 'bullet',
      });
      return;
    }

    if (nextRole === 'verified') {
      handleUpdateBlock(item.id, {
        category: 'verified',
        infoSubType: 'bullet',
      });
      return;
    }

    if (nextRole === 'graded') {
      const matchedType =
        effectiveTypes.find((t) => t.slug === item.assignmentCategory) ||
        effectiveTypes.find((t) => t.slug === 'homework') ||
        effectiveTypes[0];
      handleUpdateBlock(item.id, {
        category: 'graded',
        assignmentCategory: matchedType?.slug || 'homework',
        scoringMode:
          item.scoringMode === 'problems_calculator'
            ? 'problems_calculator'
            : matchedType?.scoring_mode === 'problems_calculator'
            ? 'problems_calculator'
            : 'points',
        pointsPossible: item.pointsPossible || matchedType?.default_points || 100,
        totalProblems:
          item.totalProblems ??
          (matchedType?.scoring_mode === 'problems_calculator' ? 20 : null),
      });
    }
  };

  const handleToggleRepeatAcrossWeek = (item: StructuredCellLineItem) => {
    const nextRepeat = !item.repeatAcrossWeek;
    const defaultDays: DayKey[] =
      item.repeatDays && item.repeatDays.length >= 2
        ? item.repeatDays
        : (['monday', 'tuesday', 'wednesday', 'thursday'] as DayKey[]);
    const ensuredDays = defaultDays.includes(dayKey)
      ? defaultDays
      : DAY_KEYS.filter((d) => defaultDays.includes(d) || d === dayKey);

    handleUpdateBlock(item.id, {
      repeatAcrossWeek: nextRepeat,
      repeatDays: nextRepeat ? ensuredDays : [dayKey],
      weeklyGroupKey:
        item.weeklyGroupKey || normalizeWeeklyBlockKey(item.text || item.id),
    });
  };

  const handleToggleRepeatDayPill = (
    item: StructuredCellLineItem,
    targetDay: DayKey
  ) => {
    const current = item.repeatDays || [dayKey];
    const exists = current.includes(targetDay);
    if (exists && current.length <= 1) return;
    const nextDays = exists
      ? current.filter((d) => d !== targetDay)
      : DAY_KEYS.filter((d) => current.includes(d) || d === targetDay);
    handleUpdateBlock(item.id, {
      repeatAcrossWeek: true,
      repeatDays: nextDays,
    });
  };

  const handleAddSubItem = (parentItem: StructuredCellLineItem) => {
    const newSub: StructuredSubItem = {
      id: `tpl-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: '',
      checked: false,
      isBullet: parentItem.category === 'info',
    };
    handleUpdateBlock(parentItem.id, {
      subItems: [...(parentItem.subItems || []), newSub],
    });
  };

  const handleUpdateSubItem = (
    parentItem: StructuredCellLineItem,
    subId: string,
    patch: Partial<StructuredSubItem>
  ) => {
    const nextSubs = (parentItem.subItems || []).map((s) =>
      s.id === subId ? { ...s, ...patch } : s
    );
    handleUpdateBlock(parentItem.id, { subItems: nextSubs });
  };

  const handleDeleteSubItem = (parentItem: StructuredCellLineItem, subId: string) => {
    const nextSubs = (parentItem.subItems || []).filter((s) => s.id !== subId);
    handleUpdateBlock(parentItem.id, { subItems: nextSubs });
  };

  const handlePromoteSubItemToStandalone = (
    parentIndex: number,
    subId: string
  ) => {
    const parentItem = items[parentIndex];
    if (!parentItem) return;
    const targetSub = (parentItem.subItems || []).find((s) => s.id === subId);
    if (!targetSub) return;

    const remainingSubs = (parentItem.subItems || []).filter((s) => s.id !== subId);
    const updatedParent: StructuredCellLineItem = {
      ...parentItem,
      subItems: remainingSubs,
    };

    const standaloneItem: StructuredCellLineItem = {
      ...parentItem,
      id: `tpl-promoted-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      text: targetSub.text,
      category: targetSub.isBullet ? 'info' : 'verified',
      infoSubType: 'bullet',
      checked: false,
      subItems: [],
      repeatAcrossWeek: false,
      repeatDays: [dayKey],
      weeklyGroupKey: normalizeWeeklyBlockKey(targetSub.text),
      assignmentId: undefined,
      assignmentRecord: undefined,
    };

    const next = [...items];
    next[parentIndex] = updatedParent;
    next.splice(parentIndex + 1, 0, standaloneItem);
    onChangeItems(next);
  };

  const handleGroupIntoPreviousBlock = (index: number) => {
    if (index <= 0) return;
    const current = items[index];
    const prev = items[index - 1];
    if (!current || !prev) return;

    const newSubFromCurrent: StructuredSubItem = {
      id: `tpl-grouped-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      text: current.text,
      checked: false,
      isBullet: current.category === 'info',
    };

    const mergedSubs: StructuredSubItem[] = [
      ...(prev.subItems || []),
      newSubFromCurrent,
      ...(current.subItems || []),
    ];

    const updatedPrev: StructuredCellLineItem = {
      ...prev,
      subItems: mergedSubs,
    };

    const next = [...items];
    next[index - 1] = updatedPrev;
    next.splice(index, 1);
    onChangeItems(next);
  };

  const handleInsertVariableToken = (token: string) => {
    if (rawMode && onChangeRawText) {
      onChangeRawText(`${rawTextValue}${rawTextValue ? ' ' : ''}${token}`);
      return;
    }

    const targetItem =
      items.find((it) => it.id === focusedBlockId) || items[items.length - 1];
    if (targetItem) {
      const nextText = targetItem.text
        ? `${targetItem.text}${targetItem.text.endsWith(' ') ? '' : ' '}${token}`
        : token;
      handleUpdateBlock(targetItem.id, { text: nextText });
    } else {
      const newId = `tpl-block-${Date.now()}`;
      onChangeItems([
        ...items,
        {
          id: newId,
          subjectId,
          dateStr: '2026-10-19',
          dayKey,
          weekdayLabel: DAY_LABELS[dayKey],
          category: 'verified',
          text: token,
          infoSubType: 'bullet',
          checked: false,
          subItems: [],
          repeatAcrossWeek: false,
          repeatDays: [dayKey],
          weeklyGroupKey: normalizeWeeklyBlockKey(token),
          assignmentCategory: 'homework',
          scoringMode: 'points',
          pointsEarned: null,
          pointsPossible: 100,
          totalProblems: null,
          problemsMissed: null,
          percentageScore: null,
          letterGrade: null,
          isApiSynced: false,
        },
      ]);
      setFocusedBlockId(newId);
    }
  };

  return (
    <Box>
      {/* Top Action Bar: Quick Add Block Buttons + Variable Tokens + Raw Mode Toggle */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={1}
        sx={{
          mb: 1.5,
          p: 1.25,
          borderRadius: 1,
          bgcolor: alpha(subjectColor, 0.04),
          border: `1px solid ${alpha(subjectColor, 0.16)}`,
        }}
      >
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
          <Typography
            variant="caption"
            fontWeight={800}
            color="text.secondary"
            sx={{ mr: 0.5, textTransform: 'uppercase', letterSpacing: 0.4 }}
          >
            Add Block:
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Heading size={13} />}
            onClick={() => handleAddBlock('header', 'header')}
            sx={{
              fontWeight: 700,
              fontSize: '0.73rem',
              py: 0.35,
              px: 1,
              borderColor: alpha(theme.palette.secondary.main, 0.4),
              color: 'secondary.main',
            }}
          >
            + Header
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Info size={13} />}
            onClick={() => handleAddBlock('info', 'bullet')}
            sx={{
              fontWeight: 700,
              fontSize: '0.73rem',
              py: 0.35,
              px: 1,
            }}
          >
            + Info / Reading
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<CheckSquare size={13} />}
            onClick={() => handleAddBlock('verified')}
            sx={{
              fontWeight: 700,
              fontSize: '0.73rem',
              py: 0.35,
              px: 1,
            }}
          >
            + Verified Check
          </Button>
          {allowGradedBlocks && (
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<Award size={13} />}
              onClick={() => handleAddBlock('graded')}
              sx={{
                fontWeight: 700,
                fontSize: '0.73rem',
                py: 0.35,
                px: 1.1,
                boxShadow: 'none',
              }}
            >
              + Graded Assignment
            </Button>
          )}
        </Stack>

        {onChangeRawText && (
          <Button
            size="small"
            variant={rawMode ? 'contained' : 'text'}
            color={rawMode ? 'primary' : 'inherit'}
            startIcon={<Code size={13} />}
            onClick={() => setRawMode((prev) => !prev)}
            sx={{ fontWeight: 700, fontSize: '0.72rem', alignSelf: { xs: 'flex-end', md: 'center' } }}
          >
            {rawMode ? 'Structured Blocks View' : 'Raw Markdown'}
          </Button>
        )}
      </Stack>

      {/* Variable Tokens Bar */}
      {showVariableTokens && (
        <Stack
          direction="row"
          spacing={0.5}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
          sx={{ mb: 1.5 }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ fontSize: '0.7rem', mr: 0.5 }}
          >
            Insert Variable:
          </Typography>
          {QUICK_TOKENS.map((t) => (
            <Chip
              key={t.token}
              size="small"
              label={t.label}
              onClick={() => handleInsertVariableToken(t.token)}
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: 'primary.main',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.16),
                },
              }}
            />
          ))}
        </Stack>
      )}

      {rawMode && onChangeRawText ? (
        <TextField
          fullWidth
          multiline
          minRows={6}
          maxRows={14}
          label={`${DAY_LABELS[dayKey]} Raw Template Markdown`}
          value={rawTextValue}
          onChange={(e) => onChangeRawText(e.target.value)}
          helperText="Use '### Header' for section headers, '•' for Info bullets, '- [ ]' for Verified checks, 2-space indent for grouped sub-lines, and '[WEEKLY:monday,tuesday,wednesday,thursday]' for weekly-shared blocks."
          sx={{
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
              fontSize: '0.82rem',
            },
          }}
        />
      ) : items.length === 0 ? (
        <Box
          sx={{
            p: 3,
            textAlign: 'center',
            borderRadius: 1,
            border: `1px dashed ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.background.default, 0.5),
          }}
        >
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {emptyPrompt}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {items.map((item, idx) => {
            const role = getVisualBlockRole(item);
            const isHeader = role === 'header';
            const isDivider = isHeader && item.infoSubType === 'divider';
            const isGraded = role === 'graded';
            const isVerified = role === 'verified';
            const hasSubItems = item.subItems && item.subItems.length > 0;

            const borderColor = isGraded
              ? alpha(theme.palette.warning.main, 0.45)
              : isVerified
              ? alpha(theme.palette.success.main, 0.4)
              : isHeader
              ? alpha(theme.palette.secondary.main, 0.35)
              : theme.palette.divider;

            const bgTint = isGraded
              ? alpha(theme.palette.warning.main, 0.04)
              : isVerified
              ? alpha(theme.palette.success.main, 0.03)
              : isHeader
              ? alpha(theme.palette.secondary.main, 0.04)
              : theme.palette.background.paper;

            return (
              <Box
                key={item.id}
                onClick={() => setFocusedBlockId(item.id)}
                sx={{
                  p: 1.25,
                  borderRadius: 1,
                  border: `1px solid ${borderColor}`,
                  bgcolor: bgTint,
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Top Row: Role Selector + Repeat All Week + Move/Group/Delete */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={role}
                      onChange={(_, val: VisualBlockRole | null) => {
                        if (val) handleRoleChange(item, val);
                      }}
                      sx={{
                        height: 26,
                        '& .MuiToggleButton-root': {
                          px: 1,
                          py: 0.25,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          textTransform: 'none',
                        },
                      }}
                    >
                      <ToggleButton value="header">
                        <Heading size={12} style={{ marginRight: 4 }} />
                        Header
                      </ToggleButton>
                      <ToggleButton value="info">
                        <Info size={12} style={{ marginRight: 4 }} />
                        Info
                      </ToggleButton>
                      <ToggleButton value="verified">
                        <CheckSquare size={12} style={{ marginRight: 4 }} />
                        Verified
                      </ToggleButton>
                      {allowGradedBlocks && (
                        <ToggleButton value="graded">
                          <Award size={12} style={{ marginRight: 4 }} />
                          Graded
                        </ToggleButton>
                      )}
                    </ToggleButtonGroup>

                    {/* Sub-type selector for Header vs Divider, or Info Bullet vs Parent Note */}
                    {isHeader && (
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={item.infoSubType === 'divider' ? 'divider' : 'header'}
                        onChange={(_, val: 'header' | 'divider' | null) => {
                          if (val) {
                            handleUpdateBlock(item.id, {
                              infoSubType: val,
                              text:
                                val === 'divider' && !item.text.trim()
                                  ? 'Section Divider'
                                  : item.text,
                            });
                          }
                        }}
                        sx={{
                          height: 24,
                          '& .MuiToggleButton-root': {
                            px: 0.85,
                            py: 0.15,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'none',
                          },
                        }}
                      >
                        <ToggleButton value="header">Section Title</ToggleButton>
                        <ToggleButton value="divider">
                          <Minus size={11} style={{ marginRight: 3 }} />
                          Divider Line
                        </ToggleButton>
                      </ToggleButtonGroup>
                    )}

                    {role === 'info' && (
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={
                          item.infoSubType === 'parent_note' ? 'parent_note' : 'bullet'
                        }
                        onChange={(_, val: 'bullet' | 'parent_note' | null) => {
                          if (val) handleUpdateBlock(item.id, { infoSubType: val });
                        }}
                        sx={{
                          height: 24,
                          '& .MuiToggleButton-root': {
                            px: 0.85,
                            py: 0.15,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'none',
                          },
                        }}
                      >
                        <ToggleButton value="bullet">School Note Bullet</ToggleButton>
                        <ToggleButton value="parent_note">Parent Note</ToggleButton>
                      </ToggleButtonGroup>
                    )}

                    {/* Repeat All Week Toggle & Day Selector Pills */}
                    {!isHeader && allowRepeatAcrossWeek && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Tooltip title="Show this block on multiple days of the week on the Weekly Binder, while grading/verifying it only ONCE per week on the Weekly Grading Summary. Editing on any day syncs across all selected days.">
                          <Chip
                            size="small"
                            icon={<Repeat size={12} />}
                            label={
                              item.repeatAcrossWeek
                                ? formatRepeatDaysShortLabel(item.repeatDays)
                                : 'Repeat All Week'
                            }
                            onClick={() => handleToggleRepeatAcrossWeek(item)}
                            color={item.repeatAcrossWeek ? 'primary' : 'default'}
                            variant={item.repeatAcrossWeek ? 'filled' : 'outlined'}
                            sx={{
                              height: 24,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          />
                        </Tooltip>

                        {item.repeatAcrossWeek && (
                          <Stack direction="row" spacing={0.35} alignItems="center">
                            {SHORT_DAY_PILLS.map((dp) => {
                              const active = item.repeatDays.includes(dp.key);
                              return (
                                <Box
                                  key={dp.key}
                                  onClick={() => handleToggleRepeatDayPill(item, dp.key)}
                                  sx={{
                                    px: 0.65,
                                    py: 0.15,
                                    borderRadius: 0.75,
                                    fontSize: '0.64rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    bgcolor: active
                                      ? theme.palette.primary.main
                                      : alpha(theme.palette.text.secondary, 0.08),
                                    color: active
                                      ? theme.palette.primary.contrastText
                                      : 'text.secondary',
                                    border: `1px solid ${
                                      active
                                        ? theme.palette.primary.main
                                        : alpha(theme.palette.divider, 0.8)
                                    }`,
                                  }}
                                >
                                  {dp.label}
                                </Box>
                              );
                            })}
                          </Stack>
                        )}
                      </Stack>
                    )}
                  </Stack>

                  {/* Right Actions: Group into Above, Add Sub-Line, Reorder, Delete */}
                  <Stack direction="row" spacing={0.25} alignItems="center">
                    {!isHeader && (
                      <Tooltip title="Add a grouped sub-line under this block (evaluated together as 1 item)">
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<Plus size={12} />}
                          onClick={() => handleAddSubItem(item)}
                          sx={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            py: 0.2,
                            px: 0.75,
                            minWidth: 0,
                          }}
                        >
                          Sub-Line
                        </Button>
                      </Tooltip>
                    )}
                    {idx > 0 && !isHeader && (
                      <Tooltip title="Group this line as a sub-item inside the block above">
                        <Button
                          size="small"
                          variant="text"
                          color="secondary"
                          onClick={() => handleGroupIntoPreviousBlock(idx)}
                          sx={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            py: 0.2,
                            px: 0.6,
                            minWidth: 0,
                          }}
                        >
                          Group ↑
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip title="Move Up">
                      <span>
                        <IconButton
                          size="small"
                          disabled={idx === 0}
                          onClick={() => handleMoveBlock(idx, -1)}
                          sx={{ p: 0.35 }}
                        >
                          <ArrowUp size={13} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move Down">
                      <span>
                        <IconButton
                          size="small"
                          disabled={idx === items.length - 1}
                          onClick={() => handleMoveBlock(idx, 1)}
                          sx={{ p: 0.35 }}
                        >
                          <ArrowDown size={13} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete Block">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteBlock(item.id)}
                        sx={{ p: 0.35 }}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                {/* Main Text Input */}
                <TextField
                  fullWidth
                  size="small"
                  placeholder={
                    isDivider
                      ? 'Optional Divider Label (or leave as Section Divider)'
                      : isHeader
                      ? 'Section Header (e.g., Complete the following:)'
                      : isGraded
                      ? 'Graded Assignment Title (e.g., Week {week}, Class {class_num} or Week {week} Spelling Test)'
                      : isVerified
                      ? 'Parent-Verified Task (e.g., Memory Work or Complete Lesson {lesson})'
                      : 'Informational / Reading Item (e.g., Novels or Read Ch. {lesson})'
                  }
                  value={item.text}
                  onChange={(e) =>
                    handleUpdateBlock(item.id, { text: e.target.value })
                  }
                  sx={{
                    '& .MuiInputBase-root': {
                      bgcolor: 'background.paper',
                      fontWeight: isHeader || isGraded ? 700 : 500,
                      fontSize: '0.84rem',
                    },
                  }}
                />

                {/* Inline Graded Assignment Configuration Row */}
                {isGraded && (
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    sx={{
                      mt: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.warning.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                    }}
                  >
                    <TextField
                      select
                      size="small"
                      label="Assignment Type"
                      value={item.assignmentCategory || 'homework'}
                      onChange={(e) => {
                        const slug = e.target.value;
                        const matched = effectiveTypes.find((t) => t.slug === slug);
                        handleUpdateBlock(item.id, {
                          assignmentCategory: slug,
                          scoringMode:
                            matched?.scoring_mode === 'problems_calculator'
                              ? 'problems_calculator'
                              : 'points',
                          pointsPossible:
                            matched?.default_points || item.pointsPossible || 100,
                        });
                      }}
                      sx={{ minWidth: 165, bgcolor: 'background.paper' }}
                    >
                      {effectiveTypes.map((t) => (
                        <MenuItem key={t.slug} value={t.slug}>
                          {t.name}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Scoring Mode"
                      value={
                        item.scoringMode === 'problems_calculator'
                          ? 'problems_calculator'
                          : 'points'
                      }
                      onChange={(e) => {
                        const mode = e.target.value as ScoringMode;
                        handleUpdateBlock(item.id, {
                          scoringMode: mode,
                          totalProblems:
                            mode === 'problems_calculator'
                              ? item.totalProblems || 20
                              : null,
                        });
                      }}
                      sx={{ minWidth: 145, bgcolor: 'background.paper' }}
                    >
                      <MenuItem value="points">Points (Earned / Max)</MenuItem>
                      <MenuItem value="problems_calculator">
                        Problems (Total / Missed)
                      </MenuItem>
                    </TextField>

                    {item.scoringMode === 'problems_calculator' ? (
                      <TextField
                        size="small"
                        type="number"
                        label="Default Total Problems"
                        value={item.totalProblems ?? 20}
                        onChange={(e) =>
                          handleUpdateBlock(item.id, {
                            totalProblems: Math.max(1, Number(e.target.value) || 20),
                          })
                        }
                        sx={{ width: 155, bgcolor: 'background.paper' }}
                      />
                    ) : (
                      <TextField
                        size="small"
                        type="number"
                        label="Points Possible"
                        value={item.pointsPossible ?? 100}
                        onChange={(e) =>
                          handleUpdateBlock(item.id, {
                            pointsPossible: Math.max(1, Number(e.target.value) || 100),
                          })
                        }
                        sx={{ width: 135, bgcolor: 'background.paper' }}
                      />
                    )}

                    <Typography
                      variant="caption"
                      color="warning.dark"
                      fontWeight={700}
                      sx={{ ml: 'auto', fontSize: '0.7rem' }}
                    >
                      {item.repeatAcrossWeek
                        ? `Creates 1 weekly graded assignment (${formatRepeatDaysShortLabel(item.repeatDays)})`
                        : item.text.includes('{class_num}')
                        ? 'Auto-substitutes Week & Class # + Syllabus Topic'
                        : `Creates graded assignment on ${DAY_LABELS[dayKey]}`}
                    </Typography>
                  </Stack>
                )}

                {/* Grouped Multi-Line Sub-Items */}
                {hasSubItems && (
                  <Box
                    sx={{
                      mt: 1,
                      pl: 1.5,
                      borderLeft: `2px solid ${alpha(subjectColor, 0.35)}`,
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 0.5 }}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Layers size={12} color={subjectColor} />
                        <Typography
                          variant="caption"
                          fontWeight={800}
                          color="text.secondary"
                          sx={{ fontSize: '0.68rem' }}
                        >
                          Grouped Sub-Lines ({item.subItems.length}) — Evaluated together as 1{' '}
                          {isGraded ? 'graded assignment' : isVerified ? 'verified check' : 'block'}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack spacing={0.75}>
                      {item.subItems.map((sub) => (
                        <Stack
                          key={sub.id}
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                        >
                          <CornerDownRight size={13} color={theme.palette.text.secondary} />
                          <Chip
                            size="small"
                            label={sub.isBullet ? 'Sub-Note' : 'Sub-Check'}
                            onClick={() =>
                              handleUpdateSubItem(item, sub.id, {
                                isBullet: !sub.isBullet,
                              })
                            }
                            variant="outlined"
                            color={sub.isBullet ? 'default' : 'success'}
                            sx={{
                              height: 22,
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          />
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Sub-line text (e.g., Memory verse, novel title, or step)"
                            value={sub.text}
                            onChange={(e) =>
                              handleUpdateSubItem(item, sub.id, {
                                text: e.target.value,
                              })
                            }
                            sx={{
                              '& .MuiInputBase-root': {
                                bgcolor: 'background.paper',
                                fontSize: '0.8rem',
                              },
                              '& .MuiInputBase-input': {
                                py: 0.5,
                              },
                            }}
                          />
                          <Tooltip title="Ungroup into its own standalone block">
                            <Button
                              size="small"
                              variant="text"
                              onClick={() =>
                                handlePromoteSubItemToStandalone(idx, sub.id)
                              }
                              sx={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                minWidth: 0,
                                px: 0.6,
                              }}
                            >
                              Ungroup
                            </Button>
                          </Tooltip>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSubItem(item, sub.id)}
                            sx={{ p: 0.3 }}
                          >
                            <Trash2 size={12} />
                          </IconButton>
                        </Stack>
                      ))}
                    </Stack>

                    <Button
                      size="small"
                      variant="text"
                      startIcon={<Plus size={12} />}
                      onClick={() => handleAddSubItem(item)}
                      sx={{ mt: 0.5, fontSize: '0.7rem', fontWeight: 700 }}
                    >
                      + Add Sub-Line to Group
                    </Button>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};
