'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  History,
  Search,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  PlusCircle,
  Edit3,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Filter,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { RouterLink } from 'src/components/base/router-link';
import { createClient } from 'src/services/supabase/client';
import type { Database, Json } from 'src/services/supabase/types';
import { getCachedActiveUserName, resolveAndSyncActiveUser } from 'src/utils/active-user';

type AuditLogRow = Database['school']['Tables']['audit_logs']['Row'];

type RevertableTable =
  | 'parent_notes'
  | 'assignments'
  | 'weekly_planner_settings'
  | 'subjects'
  | 'tasks'
  | 'time_schedule_blocks'
  | 'holidays'
  | 'habits'
  | 'recurring_assignment_templates'
  | 'math_syllabus';

interface SubjectLookup {
  id: string;
  name: string;
  color: string;
}

const TABLE_LABELS: Record<string, { label: string; color: string }> = {
  parent_notes: { label: 'Weekly Planner Cell', color: '#1b5698' },
  assignments: { label: 'Assignment & Grade', color: '#0d735c' },
  weekly_planner_settings: { label: 'Weekly Sidebar & Settings', color: '#6c43b8' },
  subjects: { label: 'Subject & Syllabus', color: '#967210' },
  tasks: { label: 'To-Do Task', color: '#b8422e' },
  time_schedule_blocks: { label: 'Weekly Time Grid', color: '#2e4a8f' },
  holidays: { label: 'Holiday', color: '#b83b48' },
  habits: { label: 'Daily Habit', color: '#1e6b43' },
  recurring_assignment_templates: { label: 'Recurring Rule', color: '#7e38b7' },
  math_syllabus: { label: 'Math Syllabus', color: '#c2511a' },
  assignment_types: { label: 'Assignment Type', color: '#475569' },
  academic_terms: { label: 'Academic Term', color: '#475569' },
  subject_term_overrides: { label: 'Report Card Override', color: '#475569' },
  transcript_settings: { label: 'Transcript Settings', color: '#475569' },
};

const REVERTABLE_TABLES: ReadonlySet<string> = new Set<RevertableTable>([
  'parent_notes',
  'assignments',
  'weekly_planner_settings',
  'subjects',
  'tasks',
  'time_schedule_blocks',
  'holidays',
  'habits',
  'recurring_assignment_templates',
  'math_syllabus',
]);

function isRevertableTable(tableName: string): tableName is RevertableTable {
  return REVERTABLE_TABLES.has(tableName);
}

function isJsonObject(val: Json | null | undefined): val is { [key: string]: Json | undefined } {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function getStringField(
  obj: { [key: string]: Json | undefined } | null,
  key: string
): string | null {
  if (!obj) return null;
  const val = obj[key];
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null;
}

function getMondayForDateStr(dateStr: string): string | null {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const day = parsed.getDay();
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(parsed);
  monday.setDate(parsed.getDate() + diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatJsonValue(
  val: Json | undefined,
  subjectMap: Map<string, SubjectLookup>,
  fieldKey?: string
): string {
  if (val === null || val === undefined) return '— (empty)';
  if (typeof val === 'string') {
    if (fieldKey === 'subject_id' && subjectMap.has(val)) {
      return `${subjectMap.get(val)?.name} (${val.slice(0, 8)}…)`;
    }
    return val.trim() === '' ? '— (blank)' : val;
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  return JSON.stringify(val, null, 2);
}

export default function AuditLogPage() {
  const theme = useTheme();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectLookup[]>([]);

  // Filter State
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expanded Row State & Undo Modal State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [revertTarget, setRevertTarget] = useState<AuditLogRow | null>(null);
  const [reverting, setReverting] = useState(false);

  const subjectMap = useMemo(() => {
    const map = new Map<string, SubjectLookup>();
    for (const s of subjects) {
      map.set(s.id, s);
    }
    return map;
  }, [subjects]);

  const loadAuditData = useCallback(
    async (isSilentRefresh = false) => {
      if (isSilentRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        await resolveAndSyncActiveUser(supabase);

        const [logsRes, subsRes] = await Promise.all([
          supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(300),
          supabase.from('subjects').select('id, name, color').order('sort_order', { ascending: true }),
        ]);

        if (logsRes.error) {
          toast.error(`Failed to load audit log: ${logsRes.error.message}`);
        } else if (logsRes.data) {
          setLogs(logsRes.data);
        }

        if (subsRes.data) {
          setSubjects(subsRes.data);
        }
      } catch {
        toast.error('Failed to load audit trail');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void loadAuditData(false);
  }, [loadAuditData]);

  const toggleExpandRow = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Summary metrics
  const metrics = useMemo(() => {
    const stephanieLogs = logs.filter((l) =>
      l.actor_name.toLowerCase().includes('stephanie')
    );
    const blakeLogs = logs.filter((l) =>
      l.actor_name.toLowerCase().includes('blake')
    );
    const revertedCount = logs.filter((l) => Boolean(l.reverted_at)).length;

    return {
      total: logs.length,
      stephanieCount: stephanieLogs.length,
      stephanieLastActive: stephanieLogs[0]?.created_at || null,
      stephanieLastSummary: stephanieLogs[0]?.summary || null,
      blakeCount: blakeLogs.length,
      blakeLastActive: blakeLogs[0]?.created_at || null,
      revertedCount,
    };
  }, [logs]);

  // Distinct actors for filter dropdown
  const availableActors = useMemo(() => {
    const set = new Set<string>(['Stephanie Womble', 'Blake Womble']);
    for (const l of logs) {
      if (l.actor_name && l.actor_name.trim()) {
        set.add(l.actor_name.trim());
      }
    }
    return Array.from(set);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((item) => {
      if (actorFilter !== 'all' && item.actor_name !== actorFilter) {
        return false;
      }
      if (tableFilter !== 'all' && item.table_name !== tableFilter) {
        return false;
      }
      if (actionFilter !== 'all' && item.action !== actionFilter) {
        return false;
      }
      if (q) {
        const hay = [
          item.summary,
          item.actor_name,
          item.actor_email || '',
          item.table_name,
          item.action,
          ...(item.changed_fields || []),
          item.old_data ? JSON.stringify(item.old_data) : '',
          item.new_data ? JSON.stringify(item.new_data) : '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [logs, actorFilter, tableFilter, actionFilter, searchQuery]);

  const canRevertLog = (item: AuditLogRow): boolean => {
    if (item.reverted_at) return false;
    if (!isRevertableTable(item.table_name)) return false;
    if (item.action === 'DELETE') {
      return isJsonObject(item.old_data) && typeof item.old_data.id === 'string';
    }
    if (item.action === 'UPDATE') {
      return isJsonObject(item.old_data) && Boolean(item.record_id);
    }
    if (item.action === 'INSERT') {
      return Boolean(item.record_id);
    }
    return false;
  };

  const handleConfirmRevert = async () => {
    if (!revertTarget) return;
    if (!isRevertableTable(revertTarget.table_name)) {
      toast.error(`Reverting table "${revertTarget.table_name}" is not supported.`);
      return;
    }

    setReverting(true);
    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();

    try {
      const tbl = revertTarget.table_name;
      let opError: { message: string } | null = null;

      if (revertTarget.action === 'INSERT') {
        // Undo an INSERT by deleting the created record
        const { error } = await supabase
          .from(tbl)
          .delete()
          .eq('id', revertTarget.record_id);
        opError = error;
      } else if (revertTarget.action === 'DELETE') {
        // Undo a DELETE by re-inserting old_data
        if (!isJsonObject(revertTarget.old_data)) {
          toast.error('No previous snapshot data available to restore this deleted item.');
          setReverting(false);
          return;
        }
        const restorePayload = { ...revertTarget.old_data };
        const { error } = await supabase
          .from(tbl)
          .upsert(restorePayload as never);
        opError = error;
      } else if (revertTarget.action === 'UPDATE') {
        // Undo an UPDATE by writing old_data back to the row
        if (!isJsonObject(revertTarget.old_data)) {
          toast.error('No previous snapshot data available to revert this update.');
          setReverting(false);
          return;
        }
        const restorePayload = { ...revertTarget.old_data };
        delete restorePayload.id;
        delete restorePayload.created_at;
        const { error } = await supabase
          .from(tbl)
          .update(restorePayload as never)
          .eq('id', revertTarget.record_id);
        opError = error;
      }

      if (opError) {
        toast.error(`Failed to revert change: ${opError.message}`);
        return;
      }

      // Mark audit log entry as reverted
      await supabase
        .from('audit_logs')
        .update({
          reverted_at: nowIso,
          reverted_by: activeUserName,
        })
        .eq('id', revertTarget.id);

      toast.success('Change successfully reverted!');
      setRevertTarget(null);
      await loadAuditData(true);
    } catch {
      toast.error('Unexpected error while reverting change');
    } finally {
      setReverting(false);
    }
  };

  const getPlannerLinkForLog = (item: AuditLogRow): string | null => {
    const newObj = isJsonObject(item.new_data) ? item.new_data : null;
    const oldObj = isJsonObject(item.old_data) ? item.old_data : null;

    if (item.table_name === 'parent_notes') {
      const noteDate = getStringField(newObj, 'note_date') || getStringField(oldObj, 'note_date');
      if (noteDate) {
        const mon = getMondayForDateStr(noteDate);
        if (mon) return `/calendar/planner?week=${mon}`;
      }
    }
    if (item.table_name === 'weekly_planner_settings') {
      const weekStart =
        getStringField(newObj, 'week_start_date') || getStringField(oldObj, 'week_start_date');
      if (weekStart) {
        return `/calendar/planner?week=${weekStart}`;
      }
    }
    if (item.table_name === 'assignments') {
      const dueDate = getStringField(newObj, 'due_date') || getStringField(oldObj, 'due_date');
      if (dueDate) {
        const mon = getMondayForDateStr(dueDate);
        if (mon) return `/calendar/planner?week=${mon}`;
      }
    }
    return null;
  };

  const renderDiffSection = (item: AuditLogRow) => {
    const oldObj = isJsonObject(item.old_data) ? item.old_data : null;
    const newObj = isJsonObject(item.new_data) ? item.new_data : null;

    // Collect keys to show
    const ignoredMetaKeys = new Set(['updated_at', 'created_at']);
    const keysToCompare: string[] = [];

    if (item.action === 'UPDATE' && item.changed_fields && item.changed_fields.length > 0) {
      for (const k of item.changed_fields) {
        if (!ignoredMetaKeys.has(k)) {
          keysToCompare.push(k);
        }
      }
    } else {
      const allKeys = new Set<string>([
        ...(oldObj ? Object.keys(oldObj) : []),
        ...(newObj ? Object.keys(newObj) : []),
      ]);
      for (const k of allKeys) {
        if (!ignoredMetaKeys.has(k)) {
          keysToCompare.push(k);
        }
      }
    }

    return (
      <Box
        sx={{
          p: 2.5,
          bgcolor: alpha(theme.palette.primary.main, 0.03),
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
          mb={2}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Field-by-Field Change Snapshot
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Record ID: <code>{item.record_id}</code> · Table: <code>school.{item.table_name}</code>
              {item.actor_email ? ` · Authenticated Email: ${item.actor_email}` : ''}
            </Typography>
          </Box>
          {canRevertLog(item) && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<RotateCcw size={15} />}
              onClick={() => setRevertTarget(item)}
              sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none' }}
            >
              Revert This Change
            </Button>
          )}
        </Stack>

        {keysToCompare.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No detailed field differences recorded for this event.
          </Typography>
        ) : (
          <Grid container spacing={1.5}>
            {keysToCompare.map((fieldKey) => {
              const beforeVal = oldObj ? oldObj[fieldKey] : undefined;
              const afterVal = newObj ? newObj[fieldKey] : undefined;
              const isChanged =
                item.action === 'UPDATE' &&
                JSON.stringify(beforeVal) !== JSON.stringify(afterVal);

              return (
                <Grid item xs={12} md={item.action === 'UPDATE' ? 12 : 6} key={fieldKey}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      borderColor: isChanged ? 'primary.main' : 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                      <Chip
                        label={fieldKey}
                        size="small"
                        color={isChanged ? 'primary' : 'default'}
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          height: 22,
                          borderRadius: 1,
                        }}
                      />
                      {isChanged && (
                        <Typography variant="caption" color="primary.main" fontWeight={700}>
                          Modified
                        </Typography>
                      )}
                    </Stack>

                    {item.action === 'UPDATE' ? (
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={6}>
                          <Box
                            sx={{
                              p: 1.25,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.error.main, 0.06),
                              border: '1px solid',
                              borderColor: alpha(theme.palette.error.main, 0.2),
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color="error.main"
                              display="block"
                              mb={0.5}
                            >
                              BEFORE (OLD VALUE)
                            </Typography>
                            <Typography
                              variant="body2"
                              component="pre"
                              sx={{
                                m: 0,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'monospace',
                                fontSize: '0.78rem',
                              }}
                            >
                              {formatJsonValue(beforeVal, subjectMap, fieldKey)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Box
                            sx={{
                              p: 1.25,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.success.main, 0.06),
                              border: '1px solid',
                              borderColor: alpha(theme.palette.success.main, 0.2),
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color="success.main"
                              display="block"
                              mb={0.5}
                            >
                              AFTER (NEW VALUE)
                            </Typography>
                            <Typography
                              variant="body2"
                              component="pre"
                              sx={{
                                m: 0,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'monospace',
                                fontSize: '0.78rem',
                              }}
                            >
                              {formatJsonValue(afterVal, subjectMap, fieldKey)}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    ) : (
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          m: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                        }}
                      >
                        {formatJsonValue(
                          item.action === 'DELETE' ? beforeVal : afterVal,
                          subjectMap,
                          fieldKey
                        )}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeading
        heading="Audit Trail & Change History"
        caption="Real-time database audit log tracking every edit across Weekly Planner cells, Assignments, Grades, Schedules, and Settings — with full user attribution and one-click Undo."
        actions={
          <Button
            variant="outlined"
            color="primary"
            startIcon={
              refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={16} />
            }
            onClick={() => void loadAuditData(true)}
            disabled={refreshing}
            sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none' }}
          >
            Refresh Log
          </Button>
        }
      />

      {/* Top Summary Cards */}
      <Grid container spacing={2.5} mb={3}>
        {/* Stephanie Womble Activity Card */}
        <Grid item xs={12} md={4}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 1,
              border: '1px solid',
              borderColor:
                actorFilter === 'Stephanie Womble' ? 'secondary.main' : 'divider',
              bgcolor:
                actorFilter === 'Stephanie Womble'
                  ? alpha(theme.palette.secondary.main, 0.05)
                  : 'background.paper',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: '#9c2d7c',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                  >
                    SW
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                      Stephanie Womble
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      stephanie.womble@gmail.com
                    </Typography>
                  </Box>
                </Stack>
                <Chip
                  label={`${metrics.stephanieCount} Edits`}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    bgcolor: alpha('#9c2d7c', 0.12),
                    color: theme.palette.mode === 'dark' ? '#f0abfc' : '#9c2d7c',
                    borderRadius: 1,
                  }}
                />
              </Stack>

              <Typography variant="body2" color="text.secondary" mb={1.5}>
                {metrics.stephanieLastActive ? (
                  <>
                    Last edit: <strong>{formatDateTime(metrics.stephanieLastActive)}</strong> (
                    {formatRelativeTime(metrics.stephanieLastActive)})
                  </>
                ) : (
                  'No recorded edits yet'
                )}
              </Typography>

              <Button
                size="small"
                variant={actorFilter === 'Stephanie Womble' ? 'contained' : 'outlined'}
                color="secondary"
                fullWidth
                onClick={() =>
                  setActorFilter((prev) =>
                    prev === 'Stephanie Womble' ? 'all' : 'Stephanie Womble'
                  )
                }
                sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none' }}
              >
                {actorFilter === 'Stephanie Womble'
                  ? 'Showing Stephanie’s Edits (Click to Show All)'
                  : 'Filter Stephanie’s Edits'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Blake Womble Activity Card */}
        <Grid item xs={12} md={4}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 1,
              border: '1px solid',
              borderColor: actorFilter === 'Blake Womble' ? 'primary.main' : 'divider',
              bgcolor:
                actorFilter === 'Blake Womble'
                  ? alpha(theme.palette.primary.main, 0.05)
                  : 'background.paper',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: 'primary.main',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                  >
                    BW
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                      Blake Womble
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      blake.womble@gmail.com
                    </Typography>
                  </Box>
                </Stack>
                <Chip
                  label={`${metrics.blakeCount} Edits`}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 700, borderRadius: 1 }}
                />
              </Stack>

              <Typography variant="body2" color="text.secondary" mb={1.5}>
                {metrics.blakeLastActive ? (
                  <>
                    Last edit: <strong>{formatDateTime(metrics.blakeLastActive)}</strong> (
                    {formatRelativeTime(metrics.blakeLastActive)})
                  </>
                ) : (
                  'No recorded edits yet'
                )}
              </Typography>

              <Button
                size="small"
                variant={actorFilter === 'Blake Womble' ? 'contained' : 'outlined'}
                color="primary"
                fullWidth
                onClick={() =>
                  setActorFilter((prev) => (prev === 'Blake Womble' ? 'all' : 'Blake Womble'))
                }
                sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none' }}
              >
                {actorFilter === 'Blake Womble'
                  ? 'Showing Blake’s Edits (Click to Show All)'
                  : 'Filter Blake’s Edits'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* System Protection & Undo Status Card */}
        <Grid item xs={12} md={4}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: alpha(theme.palette.success.main, 0.14),
                      color: 'success.main',
                    }}
                  >
                    <ShieldCheck size={20} />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                      Database Audit Triggers Active
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Verified via Supabase Auth JWT &amp; Triggers
                    </Typography>
                  </Box>
                </Stack>
                <Chip
                  label={`${metrics.total} Total`}
                  size="small"
                  color="success"
                  sx={{ fontWeight: 700, borderRadius: 1 }}
                />
              </Stack>

              <Typography variant="body2" color="text.secondary" mb={1.5}>
                Every create, update, and delete is automatically attributed to the signed-in
                Google/Supabase account with before &amp; after snapshots.
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  icon={<RotateCcw size={13} />}
                  label={`${metrics.revertedCount} Undone / Reverted`}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 600, borderRadius: 1 }}
                />
                {(actorFilter !== 'all' ||
                  tableFilter !== 'all' ||
                  actionFilter !== 'all' ||
                  searchQuery.trim() !== '') && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => {
                      setActorFilter('all');
                      setTableFilter('all');
                      setActionFilter('all');
                      setSearchQuery('');
                    }}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Reset Filters
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter & Search Bar */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by subject, note content, assignment, or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={4} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Filter by User"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
              >
                <MenuItem value="all">All Users ({logs.length})</MenuItem>
                {availableActors.map((actor) => (
                  <MenuItem key={actor} value={actor}>
                    {actor}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={4} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Filter by Area"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
              >
                <MenuItem value="all">All System Areas</MenuItem>
                <MenuItem value="parent_notes">Weekly Planner Cells</MenuItem>
                <MenuItem value="assignments">Assignments &amp; Grades</MenuItem>
                <MenuItem value="weekly_planner_settings">Weekly Sidebar &amp; Settings</MenuItem>
                <MenuItem value="subjects">Subjects &amp; Syllabi</MenuItem>
                <MenuItem value="time_schedule_blocks">Weekly Time Grid</MenuItem>
                <MenuItem value="tasks">To-Do Tasks</MenuItem>
                <MenuItem value="recurring_assignment_templates">Recurring Rules</MenuItem>
                <MenuItem value="holidays">Holidays</MenuItem>
                <MenuItem value="habits">Daily Habits</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={4} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Action Type"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <MenuItem value="all">All Actions</MenuItem>
                <MenuItem value="INSERT">Created (Insert)</MenuItem>
                <MenuItem value="UPDATE">Updated (Edit)</MenuItem>
                <MenuItem value="DELETE">Deleted (Remove)</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Main Audit Trail Table */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700, py: 1.5, width: 44 }} />
                <TableCell sx={{ fontWeight: 700, py: 1.5, minWidth: 170 }}>
                  When
                </TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, minWidth: 165 }}>
                  User
                </TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, minWidth: 150 }}>
                  Area
                </TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5, minWidth: 105 }}>
                  Action
                </TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>
                  What Changed
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 1.5, minWidth: 170 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      No matching audit log entries found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try clearing your search or user filter to see all historical activity.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((item) => {
                  const isExpanded = expandedIds.has(item.id);
                  const isStephanie = item.actor_name.toLowerCase().includes('stephanie');
                  const tableMeta = TABLE_LABELS[item.table_name] || {
                    label: item.table_name,
                    color: '#475569',
                  };
                  const plannerLink = getPlannerLinkForLog(item);
                  const revertable = canRevertLog(item);

                  return (
                    <Fragment key={item.id}>
                      <TableRow
                        hover
                        sx={{
                          cursor: 'pointer',
                          bgcolor: item.reverted_at
                            ? alpha(theme.palette.text.disabled, 0.04)
                            : 'inherit',
                        }}
                        onClick={() => toggleExpandRow(item.id)}
                      >
                        <TableCell>
                          <IconButton size="small" aria-label="Toggle change details">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </IconButton>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {formatDateTime(item.created_at)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatRelativeTime(item.created_at)}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar
                              sx={{
                                width: 26,
                                height: 26,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                bgcolor: isStephanie ? '#9c2d7c' : 'primary.main',
                              }}
                            >
                              {item.actor_name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={700}>
                                {item.actor_name}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={tableMeta.label}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              borderRadius: 1,
                              bgcolor: alpha(tableMeta.color, 0.12),
                              color:
                                theme.palette.mode === 'dark'
                                  ? alpha('#ffffff', 0.9)
                                  : tableMeta.color,
                            }}
                          />
                        </TableCell>

                        <TableCell>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Chip
                              label={
                                item.action === 'INSERT'
                                  ? 'Created'
                                  : item.action === 'UPDATE'
                                  ? 'Updated'
                                  : 'Deleted'
                              }
                              size="small"
                              color={
                                item.action === 'INSERT'
                                  ? 'success'
                                  : item.action === 'UPDATE'
                                  ? 'info'
                                  : 'error'
                              }
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: 1 }}
                            />
                            {item.reverted_at && (
                              <Chip
                                label="Reverted"
                                size="small"
                                color="warning"
                                sx={{ fontWeight: 700, fontSize: '0.68rem', borderRadius: 1 }}
                              />
                            )}
                          </Stack>
                        </TableCell>

                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{
                              textDecoration: item.reverted_at ? 'line-through' : 'none',
                              color: item.reverted_at ? 'text.secondary' : 'text.primary',
                            }}
                          >
                            {item.summary}
                          </Typography>
                          {item.changed_fields && item.changed_fields.length > 0 && (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mt={0.5}>
                              {item.changed_fields.map((f) => (
                                <Chip
                                  key={f}
                                  label={f}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.66rem',
                                    fontWeight: 600,
                                    borderRadius: 0.75,
                                  }}
                                />
                              ))}
                            </Stack>
                          )}
                          {item.reverted_at && (
                            <Typography variant="caption" color="warning.main" display="block">
                              Reverted by {item.reverted_by || 'User'} on{' '}
                              {formatDateTime(item.reverted_at)}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            {plannerLink && (
                              <Tooltip title="Open this week in Weekly Binder Planner">
                                <Button
                                  component={RouterLink}
                                  href={plannerLink}
                                  size="small"
                                  variant="text"
                                  color="primary"
                                  endIcon={<ExternalLink size={13} />}
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    textTransform: 'none',
                                    minWidth: 0,
                                  }}
                                >
                                  View Week
                                </Button>
                              </Tooltip>
                            )}
                            {revertable && (
                              <Tooltip title="Undo this change and restore previous state">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  startIcon={<RotateCcw size={13} />}
                                  onClick={() => setRevertTarget(item)}
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    borderRadius: 1,
                                    textTransform: 'none',
                                  }}
                                >
                                  Undo
                                </Button>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={7} sx={{ p: 0, borderBottom: isExpanded ? undefined : 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            {renderDiffSection(item)}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Confirmation Dialog for Reverting / Undoing a Change */}
      <Dialog
        open={Boolean(revertTarget)}
        onClose={() => !reverting && setRevertTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={20} color={theme.palette.warning.main} />
          Confirm Undo / Revert Change
        </DialogTitle>
        <DialogContent dividers>
          {revertTarget && (
            <Stack spacing={2}>
              <Alert severity="warning" sx={{ borderRadius: 1 }}>
                {revertTarget.action === 'INSERT' &&
                  'This will delete the record that was created by this action.'}
                {revertTarget.action === 'UPDATE' &&
                  'This will restore the record’s fields back to their exact values before this edit was made.'}
                {revertTarget.action === 'DELETE' &&
                  'This will re-create and restore the deleted record back into the database.'}
              </Alert>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Event Summary
                </Typography>
                <Typography variant="body1" fontWeight={700}>
                  {revertTarget.summary}
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Original Author
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {revertTarget.actor_name}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Original Timestamp
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatDateTime(revertTarget.created_at)}
                  </Typography>
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            color="inherit"
            disabled={reverting}
            onClick={() => setRevertTarget(null)}
            sx={{ fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={reverting}
            startIcon={
              reverting ? <CircularProgress size={16} color="inherit" /> : <RotateCcw size={16} />
            }
            onClick={handleConfirmRevert}
            sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none' }}
          >
            {reverting ? 'Reverting...' : 'Yes, Revert Change'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
