'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { ItemIcon } from './item-icon';

export const PARENT_NOTE_MARKER = '[PARENT_NOTE]';
export type PlannerNoteCategory = 'school_work' | 'parent_note';

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
  return text.replace(/^\s*\[PARENT_NOTE\]\s*/i, '');
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
}: FormattedParentNoteProps) {
  if (!description && !title) return null;

  const isWholeParentNote = getPlannerNoteCategory(title, description) === 'parent_note';
  const effectiveColor = isWholeParentNote ? parentNoteColor : color;
  const effectiveIcon = isWholeParentNote ? parentNoteIconName : iconName;

  const cleanTitle = stripParentNoteMarker(title);
  const rawLines = description ? description.split('\n') : [];

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

      {/* Body Lines — Bullets & Interactive Checkboxes */}
      {rawLines.map((rawLine, lineIndex) => {
        const lineHasParentMarker = rawLine.trim().startsWith(PARENT_NOTE_MARKER);
        const line = lineHasParentMarker ? stripParentNoteMarker(rawLine) : rawLine;
        const lineColor = lineHasParentMarker || isWholeParentNote ? parentNoteColor : effectiveColor;
        const lineIcon = lineHasParentMarker || isWholeParentNote ? parentNoteIconName : effectiveIcon;

        const trimmed = line.trim();
        if (!trimmed && lineIndex > 0) return null;
        if (!trimmed) return null;

        // Check if line is a Checkbox Item (- [ ] or - [x] or [ ] or [x] or ☐ or ☑)
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
          // Extract text content after checkbox marker
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
                my: 0.25,
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
              {!cleanTitle && lineIndex === 0 && isWholeParentNote && (
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
                  pt: 0.1,
                  userSelect: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  color: lineColor,
                }}
              >
                {checked ? '☑' : '☐'}
              </Box>
              <Box
                component="span"
                sx={{
                  textDecoration: checked ? 'line-through' : 'none',
                  opacity: checked ? 0.7 : 1,
                  wordBreak: 'break-word',
                  fontWeight: 500,
                }}
              >
                {content}
              </Box>
            </Box>
          );
        }

        // Check if line is a Bullet Point (- or * or •)
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
              sx={{ my: 0.2, lineHeight: 1.3, color: lineColor }}
            >
              {(!cleanTitle && lineIndex === 0 && isWholeParentNote) || lineHasParentMarker ? (
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

        // Standard Text Line
        return (
          <Box
            key={lineIndex}
            sx={{ my: 0.2, lineHeight: 1.3, wordBreak: 'break-word', fontWeight: 500, color: lineColor }}
          >
            {((!cleanTitle && lineIndex === 0 && lineIcon) || lineHasParentMarker) && (
              <ItemIcon name={lineIcon} size={11} color={lineColor} style={{ marginRight: 4, display: 'inline' }} />
            )}
            {line}
          </Box>
        );
      })}
    </Box>
  );
}
