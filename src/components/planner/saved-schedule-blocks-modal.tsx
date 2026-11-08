'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
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
  Bookmark,
  Calendar,
  CheckSquare,
  Copy,
  Edit2,
  FileText,
  Heading,
  Info,
  Layers,
  ListPlus,
  Plus,
  Repeat,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import {
  AssignmentTypeConfig,
  DEFAULT_ASSIGNMENT_TYPES,
  ScoringMode,
} from 'src/utils/gradebook-calculator';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  parseRecurringConfig,
  SavedBlockInsertStyle,
  SavedBlockRepeatMode,
  SavedScheduleBlock,
  SavedScheduleBlockSubItem,
  SubjectRecurringConfig,
} from 'src/utils/recurring-planner';
import { formatRepeatDaysShortLabel } from 'src/utils/weekly-grading-items';

export interface MinimalSavedBlockSubject {
  id: string;
  name: string;
  color: string;
  recurring_config?: Json | null;
}

export interface InsertSavedBlockOptions {
  repeatMode: SavedBlockRepeatMode;
  repeatDays: DayKey[];
  insertStyle: SavedBlockInsertStyle;
}

export interface SavedScheduleBlocksModalProps {
  open: boolean;
  onClose: () => void;
  subject: MinimalSavedBlockSubject;
  allSubjects?: MinimalSavedBlockSubject[];
  assignmentTypes?: AssignmentTypeConfig[];
  currentDayKey?: DayKey;
  defaultRepeatDays?: DayKey[];
  initialDraftBlock?: Partial<SavedScheduleBlock> | null;
  onInsertBlock?: (
    block: SavedScheduleBlock,
    options: InsertSavedBlockOptions
  ) => void;
  onSavedBlocksUpdated?: (
    subjectId: string,
    nextBlocks: SavedScheduleBlock[],
    updatedConfig: SubjectRecurringConfig
  ) => void;
}

const SHORT_DAY_PILLS: Array<{ key: DayKey; label: string }> = [
  { key: 'monday', label: 'M' },
  { key: 'tuesday', label: 'T' },
  { key: 'wednesday', label: 'W' },
  { key: 'thursday', label: 'Th' },
  { key: 'friday', label: 'F' },
];

const QUICK_HEADER_PRESETS = [
  'Memory Work',
  'Novels',
  'Complete the following:',
  'Daily Review',
  'Fast Facts',
];

function createEmptySubRow(isBullet = false, text = ''): SavedScheduleBlockSubItem {
  return {
    id: `saved-sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    isBullet,
  };
}

export function SavedScheduleBlocksModal({
  open,
  onClose,
  subject,
  allSubjects,
  assignmentTypes = DEFAULT_ASSIGNMENT_TYPES,
  currentDayKey = 'monday',
  defaultRepeatDays = ['monday', 'tuesday', 'wednesday', 'thursday'],
  initialDraftBlock = null,
  onInsertBlock,
  onSavedBlocksUpdated,
}: SavedScheduleBlocksModalProps) {
  const theme = useTheme();
  const supabase = createClient();

  const [activeSubject, setActiveSubject] =
    useState<MinimalSavedBlockSubject>(subject);
  const [subjectsList, setSubjectsList] = useState<MinimalSavedBlockSubject[]>(
    allSubjects && allSubjects.length > 0 ? allSubjects : [subject]
  );
  const [savedBlocks, setSavedBlocks] = useState<SavedScheduleBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [savingBlocks, setSavingBlocks] = useState(false);

  // Per-card quick insert overrides (so user can tweak days/cadence right before pulling into schedule)
  const [cardInsertOverrides, setCardInsertOverrides] = useState<
    Record<string, InsertSavedBlockOptions>
  >({});

  // View state: 'library' vs 'editor'
  const [viewMode, setViewMode] = useState<'library' | 'editor'>('library');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Editor form state
  const [draftName, setDraftName] = useState('');
  const [draftTitle, setDraftTitle] = useState('Memory Work');
  const [draftRole, setDraftRole] =
    useState<SavedScheduleBlock['role']>('verified');
  const [draftInfoSubType, setDraftInfoSubType] =
    useState<NonNullable<SavedScheduleBlock['infoSubType']>>('bullet');
  const [draftSubItems, setDraftSubItems] = useState<SavedScheduleBlockSubItem[]>(
    []
  );
  const [draftInsertStyle, setDraftInsertStyle] =
    useState<SavedBlockInsertStyle>('grouped');
  const [draftRepeatMode, setDraftRepeatMode] =
    useState<SavedBlockRepeatMode>('daily_repeat');
  const [draftRepeatDays, setDraftRepeatDays] = useState<DayKey[]>([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
  ]);
  const [draftAssignCategory, setDraftAssignCategory] = useState('homework');
  const [draftScoringMode, setDraftScoringMode] =
    useState<'points' | 'problems_calculator'>('points');
  const [draftPointsPossible, setDraftPointsPossible] = useState(100);
  const [draftTotalProblems, setDraftTotalProblems] = useState(20);
  const [bulkTextMode, setBulkTextMode] = useState(false);
  const [bulkTextValue, setBulkTextValue] = useState('');

  const effectiveTypes =
    assignmentTypes.length > 0 ? assignmentTypes : DEFAULT_ASSIGNMENT_TYPES;

  // Sync activeSubject when prop `subject` changes or modal opens
  useEffect(() => {
    if (!open) return;
    setActiveSubject(subject);
  }, [open, subject]);

  // Load latest saved_blocks from Supabase when modal opens or activeSubject changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const loadLatest = async () => {
      setLoadingBlocks(true);
      try {
        const { data: rowsData, error } = await supabase
          .from('subjects')
          .select('id, name, color, recurring_config')
          .order('sort_order', { ascending: true });

        if (!cancelled && !error && rowsData) {
          const typedList: MinimalSavedBlockSubject[] = rowsData.map((r) => ({
            id: r.id,
            name: r.name,
            color: r.color,
            recurring_config: r.recurring_config,
          }));
          setSubjectsList(typedList);
          const matched = typedList.find((s) => s.id === activeSubject.id);
          if (matched) {
            const cfg = parseRecurringConfig(matched.recurring_config, matched.name);
            const blocks = cfg.saved_blocks || [];
            setSavedBlocks(blocks);
            initCardOverrides(blocks);
          } else {
            const cfg = parseRecurringConfig(
              activeSubject.recurring_config,
              activeSubject.name
            );
            const blocks = cfg.saved_blocks || [];
            setSavedBlocks(blocks);
            initCardOverrides(blocks);
          }
        } else if (!cancelled) {
          const cfg = parseRecurringConfig(
            activeSubject.recurring_config,
            activeSubject.name
          );
          const blocks = cfg.saved_blocks || [];
          setSavedBlocks(blocks);
          initCardOverrides(blocks);
        }
      } catch {
        if (!cancelled) {
          const cfg = parseRecurringConfig(
            activeSubject.recurring_config,
            activeSubject.name
          );
          const blocks = cfg.saved_blocks || [];
          setSavedBlocks(blocks);
          initCardOverrides(blocks);
        }
      } finally {
        if (!cancelled) {
          setLoadingBlocks(false);
        }
      }
    };

    void loadLatest();
    return () => {
      cancelled = true;
    };
  }, [open, activeSubject.id]);

  const initCardOverrides = (blocks: SavedScheduleBlock[]) => {
    const nextOverrides: Record<string, InsertSavedBlockOptions> = {};
    for (const b of blocks) {
      const baseDays =
        b.defaultRepeatDays && b.defaultRepeatDays.length > 0
          ? b.defaultRepeatDays
          : defaultRepeatDays;
      const ensuredDays =
        b.defaultRepeatMode === 'single_day'
          ? [currentDayKey]
          : DAY_KEYS.filter((d) => baseDays.includes(d) || d === currentDayKey);
      nextOverrides[b.id] = {
        repeatMode: b.defaultRepeatMode || 'daily_repeat',
        repeatDays: ensuredDays.length > 0 ? ensuredDays : [currentDayKey],
        insertStyle: b.insertStyle || 'grouped',
      };
    }
    setCardInsertOverrides(nextOverrides);
  };

  // If opened with an `initialDraftBlock` (e.g., "Save Block to Commonly Used Blocks" from the Day Modal), open directly in Editor mode
  useEffect(() => {
    if (!open) return;
    if (initialDraftBlock) {
      openEditorWithDraft(initialDraftBlock, null);
    } else {
      setViewMode('library');
      setEditingBlockId(null);
    }
  }, [open, initialDraftBlock]);

  const openEditorWithDraft = (
    draft: Partial<SavedScheduleBlock>,
    existingId: string | null
  ) => {
    const role = draft.role || 'verified';
    const title = draft.title !== undefined ? draft.title : 'Memory Work';
    const setNum = savedBlocks.length + 1;
    const defaultName =
      draft.name ||
      (title ? `${title} — Set ${setNum}` : `Schedule Block — Set ${setNum}`);

    const subs =
      draft.subItems && draft.subItems.length > 0
        ? draft.subItems.map((s) => ({
            id: s.id || createEmptySubRow().id,
            text: s.text,
            isBullet: Boolean(s.isBullet),
          }))
        : [
            createEmptySubRow(role === 'info', ''),
            createEmptySubRow(role === 'info', ''),
            createEmptySubRow(role === 'info', ''),
            createEmptySubRow(role === 'info', ''),
          ];

    setEditingBlockId(existingId);
    setDraftName(defaultName);
    setDraftTitle(title);
    setDraftRole(role);
    setDraftInfoSubType(
      draft.infoSubType || (role === 'header' ? 'header' : 'bullet')
    );
    setDraftSubItems(subs);
    setDraftInsertStyle(draft.insertStyle || 'grouped');
    setDraftRepeatMode(draft.defaultRepeatMode || 'daily_repeat');
    setDraftRepeatDays(
      draft.defaultRepeatDays && draft.defaultRepeatDays.length > 0
        ? draft.defaultRepeatDays
        : defaultRepeatDays.length > 0
        ? defaultRepeatDays
        : ['monday', 'tuesday', 'wednesday', 'thursday']
    );
    setDraftAssignCategory(draft.assignmentCategory || 'homework');
    setDraftScoringMode(draft.scoringMode || 'points');
    setDraftPointsPossible(draft.pointsPossible || 100);
    setDraftTotalProblems(draft.totalProblems || 20);
    setBulkTextMode(false);
    setBulkTextValue(subs.map((s) => s.text).join('\n'));
    setViewMode('editor');
  };

  const handleStartCreateNew = () => {
    const existingMemCount = savedBlocks.filter((b) =>
      b.title.toLowerCase().includes('memory work')
    ).length;
    openEditorWithDraft(
      {
        name: `Memory Work — Set ${existingMemCount + 1}`,
        title: 'Memory Work',
        role: 'verified',
        infoSubType: 'bullet',
        insertStyle: 'grouped',
        defaultRepeatMode: 'daily_repeat',
        defaultRepeatDays:
          defaultRepeatDays.length > 0
            ? defaultRepeatDays
            : ['monday', 'tuesday', 'wednesday', 'thursday'],
      },
      null
    );
  };

  const handleStartEditBlock = (block: SavedScheduleBlock) => {
    openEditorWithDraft(block, block.id);
  };

  const handleDuplicateBlock = (block: SavedScheduleBlock) => {
    const nextSetMatch = block.name.match(/(.*?\bSet\s+)(\d+)(.*)/i);
    const nextName = nextSetMatch
      ? `${nextSetMatch[1]}${Number(nextSetMatch[2]) + 1}${nextSetMatch[3]}`
      : `${block.name} (Copy)`;

    openEditorWithDraft(
      {
        ...block,
        id: undefined,
        name: nextName,
        subItems: block.subItems.map((s) => ({
          ...s,
          id: createEmptySubRow(Boolean(s.isBullet), s.text).id,
        })),
      },
      null
    );
    toast.success('Duplicated block — customize the rows below and save!');
  };

  const persistSavedBlocksToSupabase = async (
    nextBlocks: SavedScheduleBlock[]
  ): Promise<boolean> => {
    setSavingBlocks(true);
    try {
      const { data: subRow, error: fetchErr } = await supabase
        .from('subjects')
        .select('id, name, recurring_config')
        .eq('id', activeSubject.id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const parsedCfg = parseRecurringConfig(
        subRow?.recurring_config ?? activeSubject.recurring_config,
        subRow?.name || activeSubject.name
      );

      const updatedCfg: SubjectRecurringConfig = {
        ...parsedCfg,
        saved_blocks: nextBlocks,
      };

      const { error: updErr } = await supabase
        .from('subjects')
        .update({
          recurring_config: JSON.parse(JSON.stringify(updatedCfg)) as Json,
        })
        .eq('id', activeSubject.id);

      if (updErr) throw updErr;

      setSavedBlocks(nextBlocks);
      initCardOverrides(nextBlocks);
      setSubjectsList((prev) =>
        prev.map((s) =>
          s.id === activeSubject.id
            ? {
                ...s,
                recurring_config: JSON.parse(JSON.stringify(updatedCfg)) as Json,
              }
            : s
        )
      );
      onSavedBlocksUpdated?.(activeSubject.id, nextBlocks, updatedCfg);
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save schedule block'
      );
      return false;
    } finally {
      setSavingBlocks(false);
    }
  };

  const handleDeleteSavedBlock = async (block: SavedScheduleBlock) => {
    const nextBlocks = savedBlocks.filter((b) => b.id !== block.id);
    const ok = await persistSavedBlocksToSupabase(nextBlocks);
    if (ok) {
      toast.success(`Removed "${block.name}" from saved blocks`);
    }
  };

  const buildBlockFromDraft = (): SavedScheduleBlock | null => {
    const effectiveTitle = draftTitle.trim() || draftName.trim();
    if (!effectiveTitle) {
      toast.error('Please enter a Block Header / Title (e.g. Memory Work).');
      return null;
    }

    const effectiveName = draftName.trim() || effectiveTitle;
    const rawSubs: SavedScheduleBlockSubItem[] = bulkTextMode
      ? bulkTextValue
          .split('\n')
          .map((line) =>
            line
              .trim()
              .replace(/^-\s*\[[ xX]\]\s*/, '')
              .replace(/^\[[ xX]\]\s*/, '')
              .replace(/^[☐☑•*-]\s*/, '')
              .trim()
          )
          .filter((line) => line.length > 0)
          .map((line) => createEmptySubRow(draftRole === 'info', line))
      : draftSubItems
          .map((s) => ({
            ...s,
            text: s.text.trim(),
          }))
          .filter((s) => s.text.length > 0);

    const orderedDays = DAY_KEYS.filter((d) => draftRepeatDays.includes(d));
    const safeRepeatDays: DayKey[] =
      orderedDays.length > 0
        ? orderedDays
        : (['monday', 'tuesday', 'wednesday', 'thursday'] as DayKey[]);

    return {
      id:
        editingBlockId ||
        `saved-blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: effectiveName,
      title: effectiveTitle,
      role: draftRole,
      infoSubType:
        draftRole === 'header'
          ? draftInfoSubType === 'divider'
            ? 'divider'
            : 'header'
          : draftRole === 'info'
          ? draftInfoSubType === 'parent_note'
            ? 'parent_note'
            : 'bullet'
          : 'bullet',
      subItems: rawSubs,
      insertStyle: draftInsertStyle,
      defaultRepeatMode: draftRepeatMode,
      defaultRepeatDays: safeRepeatDays,
      assignmentCategory: draftAssignCategory || 'homework',
      scoringMode: draftScoringMode,
      pointsPossible: draftPointsPossible || 100,
      totalProblems:
        draftScoringMode === 'problems_calculator'
          ? draftTotalProblems || 20
          : null,
      updatedAt: new Date().toISOString(),
    };
  };

  const handleSaveDraft = async (
    afterAction: 'to_library' | 'create_another' | 'insert_now'
  ) => {
    const built = buildBlockFromDraft();
    if (!built) return;

    const exists = savedBlocks.some((b) => b.id === built.id);
    const nextBlocks = exists
      ? savedBlocks.map((b) => (b.id === built.id ? built : b))
      : [...savedBlocks, built];

    const ok = await persistSavedBlocksToSupabase(nextBlocks);
    if (!ok) return;

    if (afterAction === 'insert_now' && onInsertBlock) {
      const ensuredDays =
        built.defaultRepeatMode === 'single_day'
          ? [currentDayKey]
          : DAY_KEYS.filter(
              (d) => built.defaultRepeatDays.includes(d) || d === currentDayKey
            );
      onInsertBlock(built, {
        repeatMode: built.defaultRepeatMode,
        repeatDays: ensuredDays,
        insertStyle: built.insertStyle || 'grouped',
      });
      onClose();
      return;
    }

    if (afterAction === 'create_another') {
      toast.success(`Saved "${built.name}"! Ready for your next set.`);
      const nextSetNum = nextBlocks.length + 1;
      openEditorWithDraft(
        {
          name: `${built.title} — Set ${nextSetNum}`,
          title: built.title,
          role: built.role,
          infoSubType: built.infoSubType,
          insertStyle: built.insertStyle,
          defaultRepeatMode: built.defaultRepeatMode,
          defaultRepeatDays: built.defaultRepeatDays,
          assignmentCategory: built.assignmentCategory,
          scoringMode: built.scoringMode,
          pointsPossible: built.pointsPossible,
          totalProblems: built.totalProblems,
          subItems: [],
        },
        null
      );
      return;
    }

    toast.success(
      exists
        ? `Updated "${built.name}" in ${activeSubject.name} Saved Blocks!`
        : `Saved "${built.name}" to ${activeSubject.name} Saved Blocks!`
    );
    setViewMode('library');
    setEditingBlockId(null);
  };

  const handleUpdateSubRow = (
    id: string,
    patch: Partial<SavedScheduleBlockSubItem>
  ) => {
    setDraftSubItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const handleInsertSubRowAfter = (index: number) => {
    const newRow = createEmptySubRow(draftRole === 'info', '');
    setDraftSubItems((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, newRow);
      return next;
    });
  };

  const handleAddMultipleEmptyRows = (count: number) => {
    const created: SavedScheduleBlockSubItem[] = [];
    for (let i = 0; i < count; i++) {
      created.push(createEmptySubRow(draftRole === 'info', ''));
    }
    setDraftSubItems((prev) => [...prev, ...created]);
  };

  const handleDeleteSubRow = (id: string) => {
    setDraftSubItems((prev) => prev.filter((s) => s.id !== id));
  };

  const handleMoveSubRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draftSubItems.length) return;
    setDraftSubItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handlePasteMultiLineIntoSubRow = (
    index: number,
    e: React.ClipboardEvent<HTMLDivElement>
  ) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted || !pasted.includes('\n')) return;
    const lines = pasted
      .split(/\r?\n/)
      .map((l) =>
        l
          .trim()
          .replace(/^-\s*\[[ xX]\]\s*/, '')
          .replace(/^\[[ xX]\]\s*/, '')
          .replace(/^[☐☑•*-]\s*/, '')
          .trim()
      )
      .filter((l) => l.length > 0);
    if (lines.length <= 1) return;

    e.preventDefault();
    setDraftSubItems((prev) => {
      const next = [...prev];
      const current = next[index];
      const isBullet = current ? Boolean(current.isBullet) : draftRole === 'info';
      const replacementRows = lines.map((lineText) =>
        createEmptySubRow(isBullet, lineText)
      );
      next.splice(index, 1, ...replacementRows);
      return next;
    });
    toast.success(`Split pasted text into ${lines.length} rows!`);
  };

  const handleToggleBulkTextMode = () => {
    if (!bulkTextMode) {
      const text = draftSubItems
        .map((s) => s.text.trim())
        .filter((t) => t.length > 0)
        .join('\n');
      setBulkTextValue(text);
      setBulkTextMode(true);
    } else {
      const lines = bulkTextValue
        .split(/\r?\n/)
        .map((l) =>
          l
            .trim()
            .replace(/^-\s*\[[ xX]\]\s*/, '')
            .replace(/^\[[ xX]\]\s*/, '')
            .replace(/^[☐☑•*-]\s*/, '')
            .trim()
        )
        .filter((l) => l.length > 0);
      setDraftSubItems(
        lines.length > 0
          ? lines.map((l) => createEmptySubRow(draftRole === 'info', l))
          : [createEmptySubRow(draftRole === 'info', '')]
      );
      setBulkTextMode(false);
    }
  };

  const getCardOptions = (block: SavedScheduleBlock): InsertSavedBlockOptions => {
    return (
      cardInsertOverrides[block.id] || {
        repeatMode: block.defaultRepeatMode || 'daily_repeat',
        repeatDays:
          block.defaultRepeatMode === 'single_day'
            ? [currentDayKey]
            : DAY_KEYS.filter(
                (d) =>
                  (block.defaultRepeatDays || defaultRepeatDays).includes(d) ||
                  d === currentDayKey
              ),
        insertStyle: block.insertStyle || 'grouped',
      }
    );
  };

  const updateCardOptions = (
    block: SavedScheduleBlock,
    patch: Partial<InsertSavedBlockOptions>
  ) => {
    const current = getCardOptions(block);
    setCardInsertOverrides((prev) => ({
      ...prev,
      [block.id]: {
        ...current,
        ...patch,
      },
    }));
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!savingBlocks) onClose();
      }}
      maxWidth="md"
      fullWidth
      sx={{ zIndex: 1500 }}
    >
      <DialogTitle
        sx={{
          fontWeight: 800,
          pb: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Bookmark
            size={19}
            color={activeSubject.color || theme.palette.primary.main}
          />
          <Box>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>
              {viewMode === 'editor'
                ? editingBlockId
                  ? `Edit Saved Schedule Block — ${activeSubject.name}`
                  : `Create Saved Schedule Block — ${activeSubject.name}`
                : `Commonly Used Schedule Blocks — ${activeSubject.name}`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {viewMode === 'editor'
                ? 'Configure a reusable block (such as a 6-week Memory Work set) that you can pull into any week on demand.'
                : 'Pre-create sets of Memory Work or recurring blocks here, then pull the one you need into any week’s schedule.'}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {viewMode === 'library' && subjectsList.length > 1 && (
            <TextField
              select
              size="small"
              label="Subject Library"
              value={activeSubject.id}
              onChange={(e) => {
                const chosen = subjectsList.find((s) => s.id === e.target.value);
                if (chosen) setActiveSubject(chosen);
              }}
              sx={{ minWidth: 165 }}
            >
              {subjectsList.map((s) => {
                const count =
                  parseRecurringConfig(s.recurring_config, s.name).saved_blocks
                    ?.length || 0;
                return (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name} ({count})
                  </MenuItem>
                );
              })}
            </TextField>
          )}

          {viewMode === 'library' ? (
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<Plus size={15} />}
              onClick={handleStartCreateNew}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 1,
              }}
            >
              + New Saved Block
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => {
                setViewMode('library');
                setEditingBlockId(null);
              }}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 1,
              }}
            >
              ← Back to Library ({savedBlocks.length})
            </Button>
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ py: 2.25 }}>
        {viewMode === 'library' ? (
          <Stack spacing={2}>
            <Alert severity="info" variant="outlined" sx={{ py: 0.75 }}>
              Blocks in this library are <strong>not automatically inserted</strong>{' '}
              each week. Create 2 or 3 sets (e.g.{' '}
              <em>Memory Work — Weeks 1–6</em>, <em>Memory Work — Weeks 7–12</em>)
              and pull the active set into your weekly schedule with one click.
            </Alert>

            {loadingBlocks ? (
              <Paper
                variant="outlined"
                sx={{ p: 4, textAlign: 'center', borderRadius: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Loading saved schedule blocks…
                </Typography>
              </Paper>
            ) : savedBlocks.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 4,
                  textAlign: 'center',
                  borderRadius: 1,
                  borderStyle: 'dashed',
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                }}
              >
                <Bookmark
                  size={28}
                  color={theme.palette.text.secondary}
                  style={{ marginBottom: 8 }}
                />
                <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                  No Saved Schedule Blocks for {activeSubject.name} Yet
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 520, mx: 'auto', mb: 2 }}
                >
                  Create your first reusable block (for example, a{' '}
                  <strong>Memory Work</strong> header with 6–8 rows underneath it) so
                  you can pull it into any week without retyping or copy-pasting.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Plus size={16} />}
                  onClick={handleStartCreateNew}
                  sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
                >
                  Create First Saved Block
                </Button>
              </Paper>
            ) : (
              <Stack spacing={1.5}>
                {savedBlocks.map((block) => {
                  const opts = getCardOptions(block);
                  const isGraded = block.role === 'graded';
                  const isVerified = block.role === 'verified';
                  const isHeader = block.role === 'header';

                  const roleLabel = isGraded
                    ? 'Graded Assignment'
                    : isVerified
                    ? 'Verified Checklist'
                    : isHeader
                    ? 'Section Header'
                    : 'Info / Note';

                  const roleColor = isGraded
                    ? 'success'
                    : isVerified
                    ? 'info'
                    : isHeader
                    ? 'warning'
                    : 'default';

                  return (
                    <Paper
                      key={block.id}
                      variant="outlined"
                      sx={{
                        p: 1.75,
                        borderRadius: 1,
                        borderColor: alpha(
                          activeSubject.color || theme.palette.primary.main,
                          0.35
                        ),
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack spacing={1.25}>
                        {/* Top Header Row: Set Name + Badges + Edit / Duplicate / Delete */}
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          spacing={1}
                        >
                          <Box>
                            <Stack
                              direction="row"
                              spacing={0.85}
                              alignItems="center"
                              flexWrap="wrap"
                              useFlexGap
                            >
                              <Typography variant="subtitle2" fontWeight={800}>
                                {block.name}
                              </Typography>
                              <Chip
                                size="small"
                                color={roleColor}
                                variant="outlined"
                                label={roleLabel}
                                sx={{
                                  height: 20,
                                  fontSize: '0.67rem',
                                  fontWeight: 700,
                                }}
                              />
                              {block.subItems.length > 0 && (
                                <Chip
                                  size="small"
                                  icon={<Layers size={11} />}
                                  label={`${block.subItems.length} row${
                                    block.subItems.length === 1 ? '' : 's'
                                  } underneath`}
                                  sx={{
                                    height: 20,
                                    fontSize: '0.67rem',
                                    fontWeight: 700,
                                  }}
                                />
                              )}
                            </Stack>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mt: 0.25 }}
                            >
                              Binder Block Header:{' '}
                              <strong style={{ color: theme.palette.text.primary }}>
                                {block.title}
                              </strong>
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Tooltip title="Edit this saved block">
                              <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                startIcon={<Edit2 size={13} />}
                                onClick={() => handleStartEditBlock(block)}
                                sx={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  textTransform: 'none',
                                  py: 0.3,
                                  px: 1,
                                  borderRadius: 1,
                                }}
                              >
                                Edit
                              </Button>
                            </Tooltip>
                            <Tooltip title="Duplicate block to create a new set (e.g. Set 2 or Set 3)">
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                startIcon={<Copy size={13} />}
                                onClick={() => handleDuplicateBlock(block)}
                                sx={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  textTransform: 'none',
                                  py: 0.3,
                                  px: 1,
                                  borderRadius: 1,
                                }}
                              >
                                Duplicate Set
                              </Button>
                            </Tooltip>
                            <Tooltip title="Delete saved block">
                              <IconButton
                                size="small"
                                color="error"
                                disabled={savingBlocks}
                                onClick={() => void handleDeleteSavedBlock(block)}
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>

                        {/* Preview of Rows Underneath the Block Header */}
                        {block.subItems.length > 0 && (
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.25,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.background.default, 0.65),
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight={800}
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                mb: 0.5,
                                fontSize: '0.68rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {block.title} ({block.subItems.length} rows):
                            </Typography>
                            <Stack spacing={0.35}>
                              {block.subItems.map((sub, sIdx) => (
                                <Typography
                                  key={sub.id || sIdx}
                                  variant="caption"
                                  color="text.primary"
                                  sx={{
                                    pl: 1,
                                    fontSize: '0.76rem',
                                    lineHeight: 1.35,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 0.75,
                                  }}
                                >
                                  <Box
                                    component="span"
                                    sx={{
                                      color: 'text.secondary',
                                      fontWeight: 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {sub.isBullet ? '•' : '☐'}
                                  </Box>
                                  <span>{sub.text}</span>
                                </Typography>
                              ))}
                            </Stack>
                          </Paper>
                        )}

                        {/* Insert Bar (shown when opened from the Day Modal) */}
                        {onInsertBlock && (
                          <Box
                            sx={{
                              pt: 1,
                              borderTop: '1px dashed',
                              borderColor: 'divider',
                              display: 'flex',
                              flexDirection: { xs: 'column', md: 'row' },
                              alignItems: { xs: 'stretch', md: 'center' },
                              justifyContent: 'space-between',
                              gap: 1.25,
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                              flexWrap="wrap"
                              useFlexGap
                            >
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                color="text.secondary"
                                sx={{ fontSize: '0.7rem' }}
                              >
                                Schedule as:
                              </Typography>

                              <Chip
                                size="small"
                                icon={<Calendar size={11} />}
                                label="Repeat • Verified Daily"
                                color={
                                  opts.repeatMode === 'daily_repeat'
                                    ? 'info'
                                    : 'default'
                                }
                                variant={
                                  opts.repeatMode === 'daily_repeat'
                                    ? 'filled'
                                    : 'outlined'
                                }
                                onClick={() => {
                                  const nextDays =
                                    opts.repeatDays.length > 1
                                      ? opts.repeatDays
                                      : DAY_KEYS.filter(
                                          (d) =>
                                            defaultRepeatDays.includes(d) ||
                                            d === currentDayKey
                                        );
                                  updateCardOptions(block, {
                                    repeatMode: 'daily_repeat',
                                    repeatDays: nextDays,
                                  });
                                }}
                                sx={{
                                  height: 22,
                                  fontSize: '0.67rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              />

                              <Chip
                                size="small"
                                icon={<Repeat size={11} />}
                                label="Repeat • Verified 1x/Wk"
                                color={
                                  opts.repeatMode === 'weekly_shared'
                                    ? 'secondary'
                                    : 'default'
                                }
                                variant={
                                  opts.repeatMode === 'weekly_shared'
                                    ? 'filled'
                                    : 'outlined'
                                }
                                onClick={() => {
                                  const nextDays =
                                    opts.repeatDays.length > 1
                                      ? opts.repeatDays
                                      : DAY_KEYS.filter(
                                          (d) =>
                                            defaultRepeatDays.includes(d) ||
                                            d === currentDayKey
                                        );
                                  updateCardOptions(block, {
                                    repeatMode: 'weekly_shared',
                                    repeatDays: nextDays,
                                  });
                                }}
                                sx={{
                                  height: 22,
                                  fontSize: '0.67rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              />

                              <Chip
                                size="small"
                                label={`Only ${DAY_LABELS[currentDayKey]}`}
                                color={
                                  opts.repeatMode === 'single_day'
                                    ? 'primary'
                                    : 'default'
                                }
                                variant={
                                  opts.repeatMode === 'single_day'
                                    ? 'filled'
                                    : 'outlined'
                                }
                                onClick={() =>
                                  updateCardOptions(block, {
                                    repeatMode: 'single_day',
                                    repeatDays: [currentDayKey],
                                  })
                                }
                                sx={{
                                  height: 22,
                                  fontSize: '0.67rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              />

                              {opts.repeatMode !== 'single_day' && (
                                <Stack
                                  direction="row"
                                  spacing={0.4}
                                  alignItems="center"
                                  sx={{ ml: 0.25 }}
                                >
                                  {SHORT_DAY_PILLS.map((dp) => {
                                    const selected = opts.repeatDays.includes(
                                      dp.key
                                    );
                                    return (
                                      <Chip
                                        key={dp.key}
                                        size="small"
                                        label={dp.label}
                                        color={
                                          selected
                                            ? opts.repeatMode === 'weekly_shared'
                                              ? 'secondary'
                                              : 'info'
                                            : 'default'
                                        }
                                        variant={selected ? 'filled' : 'outlined'}
                                        onClick={() => {
                                          const exists = opts.repeatDays.includes(
                                            dp.key
                                          );
                                          if (exists && opts.repeatDays.length <= 1) {
                                            return;
                                          }
                                          const next = exists
                                            ? opts.repeatDays.filter(
                                                (d) => d !== dp.key
                                              )
                                            : DAY_KEYS.filter(
                                                (d) =>
                                                  opts.repeatDays.includes(d) ||
                                                  d === dp.key
                                              );
                                          updateCardOptions(block, {
                                            repeatDays: next,
                                          });
                                        }}
                                        sx={{
                                          height: 20,
                                          minWidth: 26,
                                          fontSize: '0.66rem',
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                        }}
                                      />
                                    );
                                  })}
                                </Stack>
                              )}
                            </Stack>

                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              startIcon={<Sparkles size={14} />}
                              onClick={() => {
                                onInsertBlock(block, opts);
                                onClose();
                              }}
                              sx={{
                                fontWeight: 800,
                                textTransform: 'none',
                                borderRadius: 1,
                                px: 2,
                                flexShrink: 0,
                              }}
                            >
                              {opts.repeatMode === 'single_day'
                                ? `Pull into ${DAY_LABELS[currentDayKey]}`
                                : `Pull into Week (${formatRepeatDaysShortLabel(
                                    opts.repeatDays
                                  )})`}
                            </Button>
                          </Box>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Stack>
        ) : (
          /* EDITOR VIEW: CREATE OR EDIT A SAVED SCHEDULE BLOCK */
          <Stack spacing={2.25}>
            {/* 1. Set Label & Block Header Title */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Saved Set Name (for your Library)"
                placeholder="e.g., Memory Work — Set 1 (Weeks 1–6)"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                helperText="Helps you tell sets apart (e.g. Set 1 vs Set 2) when picking one for the week."
              />
              <TextField
                fullWidth
                size="small"
                label="Block Header / Title on Schedule"
                placeholder="e.g., Memory Work"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                helperText="The actual header text displayed on the Weekly Binder."
              />
            </Stack>

            {/* Quick Header Presets */}
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: -1 }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.68rem', mr: 0.5 }}
              >
                Quick Header Title:
              </Typography>
              {QUICK_HEADER_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  size="small"
                  label={preset}
                  variant={draftTitle === preset ? 'filled' : 'outlined'}
                  color={draftTitle === preset ? 'primary' : 'default'}
                  onClick={() => {
                    setDraftTitle(preset);
                    if (!draftName.trim()) {
                      setDraftName(`${preset} — Set ${savedBlocks.length + 1}`);
                    }
                  }}
                  sx={{
                    height: 20,
                    fontSize: '0.67rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Stack>

            {/* 2. Block Role Selector */}
            <Box>
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                sx={{ display: 'block', mb: 0.75 }}
              >
                Block Role on Binder &amp; Grading Summary
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={draftRole}
                onChange={(_, val: SavedScheduleBlock['role'] | null) => {
                  if (!val) return;
                  setDraftRole(val);
                  if (val === 'header') {
                    setDraftInfoSubType('header');
                  } else if (val === 'info') {
                    setDraftInfoSubType('bullet');
                  }
                }}
              >
                <ToggleButton
                  value="verified"
                  sx={{ fontWeight: 700, textTransform: 'none', gap: 0.6 }}
                >
                  <CheckSquare size={14} />
                  Verified Checklist
                </ToggleButton>
                <ToggleButton
                  value="header"
                  sx={{ fontWeight: 700, textTransform: 'none', gap: 0.6 }}
                >
                  <Heading size={14} />
                  Section Header
                </ToggleButton>
                <ToggleButton
                  value="graded"
                  sx={{ fontWeight: 700, textTransform: 'none', gap: 0.6 }}
                >
                  <Award size={14} />
                  Graded Assignment
                </ToggleButton>
                <ToggleButton
                  value="info"
                  sx={{ fontWeight: 700, textTransform: 'none', gap: 0.6 }}
                >
                  <Info size={14} />
                  Info / Reading Note
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {draftRole === 'graded' && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.success.main, 0.04),
                  borderColor: alpha(theme.palette.success.main, 0.25),
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <TextField
                    select
                    size="small"
                    label="Category"
                    value={draftAssignCategory}
                    onChange={(e) => setDraftAssignCategory(e.target.value)}
                    sx={{ flex: 1 }}
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
                    value={draftScoringMode}
                    onChange={(e) =>
                      setDraftScoringMode(e.target.value as ScoringMode === 'problems_calculator' ? 'problems_calculator' : 'points')
                    }
                    sx={{ flex: 1 }}
                  >
                    <MenuItem value="points">Points (Earned / Max)</MenuItem>
                    <MenuItem value="problems_calculator">Problems Missed</MenuItem>
                  </TextField>
                  {draftScoringMode === 'problems_calculator' ? (
                    <TextField
                      type="number"
                      size="small"
                      label="Total Problems"
                      value={draftTotalProblems}
                      onChange={(e) =>
                        setDraftTotalProblems(
                          Math.max(1, Number(e.target.value) || 20)
                        )
                      }
                      sx={{ width: { xs: '100%', sm: 130 } }}
                    />
                  ) : (
                    <TextField
                      type="number"
                      size="small"
                      label="Max Points"
                      value={draftPointsPossible}
                      onChange={(e) =>
                        setDraftPointsPossible(
                          Math.max(1, Number(e.target.value) || 100)
                        )
                      }
                      sx={{ width: { xs: '100%', sm: 120 } }}
                    />
                  )}
                </Stack>
              </Paper>
            )}

            {/* 3. Rows Underneath the Block Header (e.g. 6–8 rows of Memory Work) */}
            <Paper
              variant="outlined"
              sx={{
                p: 1.75,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.default, 0.5),
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1}
                mb={1.25}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight={800}>
                    Rows Underneath &ldquo;{draftTitle || 'Block Header'}&rdquo; (
                    {bulkTextMode
                      ? bulkTextValue
                          .split('\n')
                          .filter((l) => l.trim().length > 0).length
                      : draftSubItems.filter((s) => s.text.trim().length > 0)
                          .length}{' '}
                    filled)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Add the 6–8 rows of memory work or exercises that go underneath
                    this block header. Tip: You can also paste multi-line text into
                    any row to auto-split!
                  </Typography>
                </Box>

                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Button
                    size="small"
                    variant={bulkTextMode ? 'contained' : 'outlined'}
                    color={bulkTextMode ? 'secondary' : 'inherit'}
                    startIcon={<FileText size={13} />}
                    onClick={handleToggleBulkTextMode}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      textTransform: 'none',
                      borderRadius: 1,
                    }}
                  >
                    {bulkTextMode ? 'Switch to Row Inputs' : 'Bulk Paste / Text Mode'}
                  </Button>
                </Stack>
              </Stack>

              {bulkTextMode ? (
                <TextField
                  fullWidth
                  multiline
                  minRows={7}
                  maxRows={14}
                  placeholder={
                    'Paste or type 1 item per line (e.g. 6–8 rows of Memory Work):\nLine 1...\nLine 2...\nLine 3...'
                  }
                  value={bulkTextValue}
                  onChange={(e) => setBulkTextValue(e.target.value)}
                  helperText="Each line will become its own row underneath the block header."
                  sx={{ bgcolor: 'background.paper' }}
                />
              ) : (
                <Stack spacing={0.85}>
                  {draftSubItems.map((sub, idx) => (
                    <Stack
                      key={sub.id}
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                    >
                      <Typography
                        variant="caption"
                        fontWeight={800}
                        color="text.secondary"
                        sx={{ width: 22, textAlign: 'right', flexShrink: 0 }}
                      >
                        {idx + 1}.
                      </Typography>

                      <Tooltip
                        title={
                          sub.isBullet
                            ? 'Currently Info Bullet (•). Click to switch to Checkbox (☐).'
                            : 'Currently Checkbox (☐). Click to switch to Info Bullet (•).'
                        }
                      >
                        <Chip
                          size="small"
                          label={sub.isBullet ? '• Bullet' : '☐ Check'}
                          color={sub.isBullet ? 'default' : 'info'}
                          variant="outlined"
                          onClick={() =>
                            handleUpdateSubRow(sub.id, {
                              isBullet: !sub.isBullet,
                            })
                          }
                          sx={{
                            height: 24,
                            fontSize: '0.67rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />
                      </Tooltip>

                      <TextField
                        fullWidth
                        size="small"
                        placeholder={`Row ${
                          idx + 1
                        } underneath ${draftTitle || 'header'} (press Enter for next row, or paste multiple lines)…`}
                        value={sub.text}
                        onChange={(e) =>
                          handleUpdateSubRow(sub.id, { text: e.target.value })
                        }
                        onPaste={(e) => handlePasteMultiLineIntoSubRow(idx, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleInsertSubRowAfter(idx);
                          } else if (
                            e.key === 'Backspace' &&
                            sub.text === '' &&
                            draftSubItems.length > 1
                          ) {
                            e.preventDefault();
                            handleDeleteSubRow(sub.id);
                          }
                        }}
                        sx={{
                          bgcolor: 'background.paper',
                          '& .MuiInputBase-input': {
                            py: 0.55,
                            fontSize: '0.82rem',
                          },
                        }}
                      />

                      <IconButton
                        size="small"
                        disabled={idx === 0}
                        onClick={() => handleMoveSubRow(idx, -1)}
                        sx={{ p: 0.35 }}
                      >
                        <ArrowUp size={13} />
                      </IconButton>
                      <IconButton
                        size="small"
                        disabled={idx === draftSubItems.length - 1}
                        onClick={() => handleMoveSubRow(idx, 1)}
                        sx={{ p: 0.35 }}
                      >
                        <ArrowDown size={13} />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSubRow(sub.id)}
                        sx={{ p: 0.35 }}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Stack>
                  ))}

                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                    pt={0.5}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Plus size={14} />}
                      onClick={() =>
                        handleInsertSubRowAfter(draftSubItems.length - 1)
                      }
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.73rem',
                        textTransform: 'none',
                        borderRadius: 1,
                      }}
                    >
                      + Add Row
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<ListPlus size={14} />}
                      onClick={() => handleAddMultipleEmptyRows(4)}
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.73rem',
                        textTransform: 'none',
                        borderRadius: 1,
                      }}
                    >
                      + Add 4 More Rows
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Paper>

            {/* 4. Default Weekly Repeat Behavior & Insert Structure */}
            <Box>
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                sx={{ display: 'block', mb: 0.75 }}
              >
                Default Schedule Repeat Behavior When Pulled Into a Week
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={draftRepeatMode}
                onChange={(_, val: SavedBlockRepeatMode | null) => {
                  if (val) setDraftRepeatMode(val);
                }}
              >
                <ToggleButton
                  value="daily_repeat"
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Repeat Daily (Verified Each Selected Day)
                </ToggleButton>
                <ToggleButton
                  value="weekly_shared"
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Repeat Weekly (Verified / Graded 1x / Week)
                </ToggleButton>
                <ToggleButton
                  value="single_day"
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Single Day Only
                </ToggleButton>
              </ToggleButtonGroup>

              {draftRepeatMode !== 'single_day' && (
                <Box sx={{ mt: 1.25 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 0.6 }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      Default Weekdays to Populate:
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      <Chip
                        size="small"
                        label="Mon–Thu"
                        variant="outlined"
                        onClick={() =>
                          setDraftRepeatDays([
                            'monday',
                            'tuesday',
                            'wednesday',
                            'thursday',
                          ])
                        }
                        sx={{ height: 20, fontSize: '0.66rem', cursor: 'pointer' }}
                      />
                      <Chip
                        size="small"
                        label="Mon–Fri"
                        variant="outlined"
                        onClick={() => setDraftRepeatDays([...DAY_KEYS])}
                        sx={{ height: 20, fontSize: '0.66rem', cursor: 'pointer' }}
                      />
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={0.75}>
                    {DAY_KEYS.map((dk) => {
                      const selected = draftRepeatDays.includes(dk);
                      return (
                        <Button
                          key={dk}
                          size="small"
                          variant={selected ? 'contained' : 'outlined'}
                          color={
                            selected
                              ? draftRepeatMode === 'weekly_shared'
                                ? 'secondary'
                                : 'info'
                              : 'inherit'
                          }
                          onClick={() => {
                            setDraftRepeatDays((prev) => {
                              if (prev.includes(dk)) {
                                return prev.length > 1
                                  ? prev.filter((d) => d !== dk)
                                  : prev;
                              }
                              return DAY_KEYS.filter(
                                (d) => d === dk || prev.includes(d)
                              );
                            });
                          }}
                          sx={{
                            flex: 1,
                            py: 0.5,
                            fontWeight: 700,
                            textTransform: 'none',
                            borderRadius: 1,
                          }}
                        >
                          {DAY_LABELS[dk].slice(0, 3)}
                        </Button>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Box>

            <Box>
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                sx={{ display: 'block', mb: 0.75 }}
              >
                How Rows Underneath Header Are Added to the Day Editor
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={draftInsertStyle}
                onChange={(_, val: SavedBlockInsertStyle | null) => {
                  if (val) setDraftInsertStyle(val);
                }}
              >
                <ToggleButton
                  value="grouped"
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Grouped Sub-Lines Under Block Header (Recommended)
                </ToggleButton>
                <ToggleButton
                  value="separate_rows"
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Header Row + Separate Individual Rows Below It
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 1.5,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {viewMode === 'library' ? (
          <>
            <Typography variant="caption" color="text.secondary">
              {savedBlocks.length} saved block{savedBlocks.length === 1 ? '' : 's'}{' '}
              for {activeSubject.name}
            </Typography>
            <Button
              variant="outlined"
              color="inherit"
              onClick={onClose}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
            >
              Close
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              color="inherit"
              disabled={savingBlocks}
              onClick={() => {
                setViewMode('library');
                setEditingBlockId(null);
              }}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
            >
              Cancel
            </Button>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                color="secondary"
                disabled={savingBlocks}
                startIcon={<Plus size={15} />}
                onClick={() => void handleSaveDraft('create_another')}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
              >
                Save &amp; Add Next Set
              </Button>
              <Button
                variant={onInsertBlock ? 'outlined' : 'contained'}
                color="primary"
                disabled={savingBlocks}
                startIcon={<Save size={15} />}
                onClick={() => void handleSaveDraft('to_library')}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
              >
                {savingBlocks ? 'Saving…' : 'Save to Library'}
              </Button>
              {onInsertBlock && (
                <Button
                  variant="contained"
                  color="primary"
                  disabled={savingBlocks}
                  startIcon={<Sparkles size={15} />}
                  onClick={() => void handleSaveDraft('insert_now')}
                  sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1 }}
                >
                  Save &amp; Pull into Schedule
                </Button>
              )}
            </Stack>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
