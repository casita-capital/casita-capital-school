'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { ItemIcon } from './item-icon';

export const PARENT_NOTE_MARKER = '[PARENT_NOTE]';
export const WEEKLY_SHARED_MARKER_REGEX = /^\s*\[WEEKLY(?::([a-z,]+))?\]\s*/i;
export const VERIFIED_META_MARKER_REGEX = /\s*\[VERIFIED:([^\]|]*)\|([^\]]*)\]\s*$/i;
export type PlannerNoteCategory = 'school_work' | 'parent_note';

export function stripVerifiedMetaMarker(text?: string | null): string {
  if (!text) return '';
  return text.replace(VERIFIED_META_MARKER_REGEX, '');
}

export function extractVerifiedMetaFromLine(text?: string | null): {
  verifiedBy: string | null;
  verifiedAt: string | null;
  cleanText: string;
} {
  if (!text) {
    return { verifiedBy: null, verifiedAt: null, cleanText: '' };
  }
  const match = text.match(VERIFIED_META_MARKER_REGEX);
  if (!match) {
    return { verifiedBy: null, verifiedAt: null, cleanText: text };
  }
  return {
    verifiedBy: match[1]?.trim() || null,
    verifiedAt: match[2]?.trim() || null,
    cleanText: text.replace(VERIFIED_META_MARKER_REGEX, ''),
  };
}

export function stripWeeklySharedMarker(text?: string | null): string {
  if (!text) return '';
  return stripVerifiedMetaMarker(text.replace(WEEKLY_SHARED_MARKER_REGEX, ''));
}

export function extractWeeklySharedDaysFromLine(text?: string | null): {
  isWeeklyShared: boolean;
  daysCsv: string | null;
  cleanText: string;
} {
  if (!text) {
    return { isWeeklyShared: false, daysCsv: null, cleanText: '' };
  }
  const match = text.match(WEEKLY_SHARED_MARKER_REGEX);
  if (!match) {
    return { isWeeklyShared: false, daysCsv: null, cleanText: stripVerifiedMetaMarker(text) };
  }
  return {
    isWeeklyShared: true,
    daysCsv: match[1] ? match[1].toLowerCase() : null,
    cleanText: stripVerifiedMetaMarker(text.replace(WEEKLY_SHARED_MARKER_REGEX, '')),
  };
}

export function getPlannerNoteCategory(
  title?: string | null,
  description?: string | null
): PlannerNoteCategory {
  if (title && title.trim().startsWith(PARENT_NOTE_MARKER)) {
    return 'parent_note';
  }
  if (description && description.trim().startsWith(PARENT_NOTE_MARKER)) {
    return 'parent_note';
  }
  return 'school_work';
}

export function stripParentNoteMarker(text?: string | null): string {
  if (!text) return '';
  return stripWeeklySharedMarker(text.replace(/^\s*\[PARENT_NOTE\]\s*/i, ''));
}

export function encodePlannerNoteFields(
  rawTitle: string | null,
  rawDescription: string,
  category: PlannerNoteCategory
): { title: string | null; description: string } {
  const cleanTitle = stripParentNoteMarker(rawTitle).trim();
  const cleanDesc = stripParentNoteMarker(rawDescription).trim();

  if (category === 'parent_note') {
    if (cleanTitle) {
      return {
        title: `${PARENT_NOTE_MARKER} ${cleanTitle}`,
        description: cleanDesc,
      };
    }
    return {
      title: null,
      description: cleanDesc ? `${PARENT_NOTE_MARKER} ${cleanDesc}` : PARENT_NOTE_MARKER,
    };
  }

  return {
    title: cleanTitle || null,
    description: cleanDesc,
  };
}

/**
 * Checks whether a single line from `parent_notes` is already represented by a
 * graded/tracked assignment in `school.assignments` on the same subject & day.
 */
export function isNoteLineCoveredByAssignment(
  rawNoteLine: string,
  assignmentTitles: string[]
): boolean {
  if (!assignmentTitles || assignmentTitles.length === 0) return false;
  const cleanLine = stripParentNoteMarker(rawNoteLine)
    .trim()
    .replace(/^-\s*\[[ xX]\]\s*/, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .replace(/^[☐☑•*-]\s*/, '')
    .replace(/^###\s*/, '')
    .trim();
  if (!cleanLine) return false;

  const normLine = cleanLine.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normLine) return false;

  const lineWeekClassMatch = cleanLine.match(/^week\s+(\d+)\s*,\s*class\s+(\d+|\{class_num\})/i);
  const lineSpellingTestMatch = cleanLine.match(/^week\s+(\d+)\s*,?\s*test$/i);

  for (const rawAssignTitle of assignmentTitles) {
    const cleanAssign = rawAssignTitle.trim();
    const normAssign = cleanAssign.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normAssign) continue;

    if (normLine === normAssign) return true;

    // Match "Week 8, Class 22: ..." note against "Week 8, Class 22..." assignment
    if (lineWeekClassMatch) {
      const assignWeekClassMatch = cleanAssign.match(
        /^week\s+(\d+)\s*,\s*class\s+(\d+|\{class_num\})/i
      );
      if (
        assignWeekClassMatch &&
        lineWeekClassMatch[1] === assignWeekClassMatch[1] &&
        (lineWeekClassMatch[2] === assignWeekClassMatch[2] ||
          assignWeekClassMatch[2] === '{class_num}' ||
          lineWeekClassMatch[2] === '{class_num}')
      ) {
        return true;
      }
    }

    // Match "Memory Work: ..." note against "Memory Work..." assignment
    if (/^memory\s+work\b/i.test(cleanLine) && /^memory\s+work\b/i.test(cleanAssign)) {
      return true;
    }

    // Match "Week 8, TEST" note against "Week 8 Spelling Test" assignment
    if (lineSpellingTestMatch) {
      const wk = lineSpellingTestMatch[1];
      const re = new RegExp(`^week\\s+${wk}\\b.*\\btest\\b`, 'i');
      if (re.test(cleanAssign)) return true;
    }
  }

  return false;
}

interface FormattedParentNoteProps {
  noteId?: string;
  title?: string | null;
  description: string;
  color?: string;
  iconName?: string;
  parentNoteColor?: string;
  parentNoteIconName?: string;
  onToggleCheckbox?: (noteId: string, lineIndex: number, newChecked: boolean) => void;
  interactive?: boolean;
  /** Optional list of assignment titles in the same cell to suppress duplicate note lines */
  excludeAssignmentTitles?: string[];
}

export function FormattedParentNote({
  noteId,
  title,
  description,
  color = '#D97706',
  iconName = 'Edit3',
  parentNoteColor = '#8B5CF6',
  parentNoteIconName = 'User',
  onToggleCheckbox,
  interactive = true,
  excludeAssignmentTitles,
}: FormattedParentNoteProps) {
  if (!description && !title) return null;

  const isWholeParentNote = getPlannerNoteCategory(title, description) === 'parent_note';
  const effectiveColor = isWholeParentNote ? parentNoteColor : color;
  const effectiveIcon = isWholeParentNote ? parentNoteIconName : iconName;

  const cleanTitle = stripParentNoteMarker(title);
  const rawLines = description ? description.split('\n') : [];

  const visibleLineEntries = (() => {
    const entries: Array<{ rawLine: string; lineIndex: number }> = [];
    let skippingCoveredGroup = false;
    let skippingMemoryWorkSection = false;

    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
      const rawLine = rawLines[lineIndex];
      const isIndented = /^\s{2,}/.test(rawLine);
      const trimmed = stripWeeklySharedMarker(rawLine).trim();
      if (!trimmed) continue;

      if (skippingCoveredGroup) {
        if (isIndented) {
          continue;
        }
        skippingCoveredGroup = false;
      }

      if (skippingMemoryWorkSection) {
        const strippedNext = trimmed
          .replace(/^###\s*/, '')
          .replace(/^[•*-]\s*/, '')
          .trim();
        const isNextSectionHeader =
          /^---/.test(trimmed) ||
          trimmed.startsWith('### ') ||
          /^(complete the following|fable|grammar|novels|attend class)\s*:?$/i.test(
            strippedNext
          );
        if (!isNextSectionHeader) {
          continue;
        }
        skippingMemoryWorkSection = false;
      }

      if (
        excludeAssignmentTitles &&
        excludeAssignmentTitles.length > 0 &&
        isNoteLineCoveredByAssignment(trimmed, excludeAssignmentTitles)
      ) {
        skippingCoveredGroup = true;
        const strippedForMem = trimmed
          .replace(/^###\s*/, '')
          .replace(/^-\s*\[[ xX]\]\s*/, '')
          .replace(/^[☐☑•*-]\s*/, '')
          .trim();
        if (/^memory\s+work\b/i.test(strippedForMem)) {
          skippingMemoryWorkSection = true;
        }
        continue;
      }

      entries.push({ rawLine, lineIndex });
    }
    return entries;
  })();

  if (!cleanTitle && visibleLineEntries.length === 0) {
    return null;
  }

  return (
    <Box
      className="formatted-parent-note-block"
      sx={{
        color: effectiveColor,
        fontSize: '0.73rem',
        mb: 1,
        pb: 0.5,
        borderBottom: '1px dashed',
        borderColor: 'divider',
        '&:last-child': {
          mb: 0,
          pb: 0,
          borderBottom: 'none',
        },
      }}
    >
      {/* Header — Always Bold */}
      {cleanTitle && (
        <Box display="flex" alignItems="center" gap={0.5} mb={0.25}>
          <ItemIcon name={effectiveIcon} size={11} color={effectiveColor} />
          <Typography
            variant="caption"
            fontWeight={900}
            className="note-header-title"
            sx={{
              color: effectiveColor,
              fontSize: '0.72rem',
              letterSpacing: 0.2,
              display: 'inline-block',
            }}
          >
            {cleanTitle}
          </Typography>
        </Box>
      )}

      {/* Body Lines — Headers, Dividers, Bullets, Indented Group Sub-Items & Interactive Checkboxes */}
      {visibleLineEntries.map(({ rawLine, lineIndex }, visibleIdx) => {
        const isIndentedSubItem = /^\s{2,}/.test(rawLine);
        const lineWithoutWeekly = stripWeeklySharedMarker(rawLine);
        const lineHasParentMarker = lineWithoutWeekly.trim().startsWith(PARENT_NOTE_MARKER);
        const line = lineHasParentMarker
          ? stripParentNoteMarker(lineWithoutWeekly)
          : lineWithoutWeekly;
        const lineColor =
          lineHasParentMarker || isWholeParentNote ? parentNoteColor : effectiveColor;
        const lineIcon =
          lineHasParentMarker || isWholeParentNote ? parentNoteIconName : effectiveIcon;

        const trimmed = line.trim();
        if (!trimmed) return null;

        // 1. Horizontal Divider Line (--- or --- Section Label)
        if (/^---+(?:\s+(.*))?$/.test(trimmed)) {
          const dividerMatch = trimmed.match(/^---+(?:\s+(.*))?$/);
          const dividerLabel = dividerMatch?.[1]?.trim() || '';
          return (
            <Box
              key={lineIndex}
              sx={{
                my: 0.5,
                pt: 0.25,
                borderTop: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {dividerLabel && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {dividerLabel}
                </Typography>
              )}
            </Box>
          );
        }

        // 2. Explicit Section Header (### Header or unprefixed Header ending with colon that isn't a checkbox or bullet)
        const isExplicitHeader =
          trimmed.startsWith('### ') ||
          (!isIndentedSubItem &&
            !trimmed.startsWith('- [') &&
            !trimmed.startsWith('[') &&
            !trimmed.startsWith('☐') &&
            !trimmed.startsWith('☑') &&
            !trimmed.startsWith('•') &&
            !trimmed.startsWith('-') &&
            !trimmed.startsWith('*') &&
            (/^(complete the following|memory work|fable|grammar|novels|attend class)\s*:?$/i.test(
              trimmed
            ) ||
              (trimmed.endsWith(':') && trimmed.length <= 48)));

        if (isExplicitHeader) {
          const headerText = trimmed
            .replace(/^###\s*/, '')
            .replace(/^[-*•]\s*/, '')
            .trim();
          return (
            <Box
              key={lineIndex}
              sx={{
                mt: visibleIdx > 0 ? 0.45 : 0.1,
                mb: 0.15,
                lineHeight: 1.25,
                fontWeight: 800,
                fontSize: '0.71rem',
                color: lineColor,
                letterSpacing: '0.01em',
              }}
            >
              {headerText}
            </Box>
          );
        }

        // 3. Checkbox Item (- [ ] or - [x] or [ ] or [x] or ☐ or ☑)
        const isUnchecked =
          trimmed.startsWith('- [ ]') || trimmed.startsWith('[ ]') || trimmed.startsWith('☐');
        const isChecked =
          trimmed.startsWith('- [x]') ||
          trimmed.startsWith('- [X]') ||
          trimmed.startsWith('[x]') ||
          trimmed.startsWith('[X]') ||
          trimmed.startsWith('☑');

        if (isUnchecked || isChecked) {
          const checked = isChecked;
          const content = trimmed
            .replace(/^-\s*\[[ xX]\]\s*/, '')
            .replace(/^\[[ xX]\]\s*/, '')
            .replace(/^[☐☑]\s*/, '');

          return (
            <Box
              key={lineIndex}
              display="flex"
              alignItems="flex-start"
              gap={0.5}
              sx={{
                my: 0.2,
                pl: isIndentedSubItem ? 1.5 : 0,
                lineHeight: 1.3,
                color: lineColor,
                cursor: interactive && onToggleCheckbox && noteId ? 'pointer' : 'default',
              }}
              onClick={(e) => {
                if (interactive && onToggleCheckbox && noteId) {
                  e.stopPropagation();
                  onToggleCheckbox(noteId, lineIndex, !checked);
                }
              }}
            >
              {!cleanTitle && visibleIdx === 0 && isWholeParentNote && (
                <ItemIcon
                  name={lineIcon}
                  size={11}
                  color={lineColor}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
              )}
              <Box
                component="span"
                className="note-checkbox-icon"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mt: '2px',
                  width: isIndentedSubItem ? 10 : 11,
                  height: isIndentedSubItem ? 10 : 11,
                  border: '1.5px solid',
                  borderColor: lineColor,
                  borderRadius: '2px',
                  bgcolor: checked ? lineColor : 'transparent',
                  color: '#ffffff',
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                {checked && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5.2L4.1 7.3L8.2 2.7"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Box>
              <Box
                component="span"
                sx={{
                  textDecoration: checked ? 'line-through' : 'none',
                  opacity: checked ? 0.7 : 1,
                  wordBreak: 'break-word',
                  fontWeight: content.endsWith(':') ? 700 : 500,
                }}
              >
                {content}
              </Box>
            </Box>
          );
        }

        // 4. Bullet Point (- or * or •)
        const isBullet =
          trimmed.startsWith('•') ||
          (trimmed.startsWith('-') && !trimmed.startsWith('- [')) ||
          trimmed.startsWith('*');

        if (isBullet) {
          const content = trimmed.replace(/^[-*•]\s*/, '');
          return (
            <Box
              key={lineIndex}
              display="flex"
              alignItems="flex-start"
              gap={0.5}
              sx={{
                my: 0.2,
                pl: isIndentedSubItem ? 1.5 : 0,
                lineHeight: 1.3,
                color: lineColor,
              }}
            >
              {(!cleanTitle && visibleIdx === 0 && isWholeParentNote) || lineHasParentMarker ? (
                <ItemIcon
                  name={lineIcon}
                  size={11}
                  color={lineColor}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
              ) : (
                <Box component="span" sx={{ fontSize: '0.8rem', lineHeight: 1, pt: 0.2 }}>
                  •
                </Box>
              )}
              <Box component="span" sx={{ wordBreak: 'break-word', fontWeight: 500 }}>
                {content}
              </Box>
            </Box>
          );
        }

        // 5. Standard Text Line
        return (
          <Box
            key={lineIndex}
            sx={{
              my: 0.2,
              pl: isIndentedSubItem ? 1.5 : 0,
              lineHeight: 1.3,
              wordBreak: 'break-word',
              fontWeight: 500,
              color: lineColor,
            }}
          >
            {((!cleanTitle && visibleIdx === 0 && lineIcon) || lineHasParentMarker) && (
              <ItemIcon
                name={lineIcon}
                size={11}
                color={lineColor}
                style={{ marginRight: 4, display: 'inline' }}
              />
            )}
            {trimmed}
          </Box>
        );
      })}
    </Box>
  );
}
