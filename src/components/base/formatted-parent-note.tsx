'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { ItemIcon } from './item-icon';

interface FormattedParentNoteProps {
  noteId?: string;
  title?: string | null;
  description: string;
  color?: string;
  iconName?: string;
  onToggleCheckbox?: (noteId: string, lineIndex: number, newChecked: boolean) => void;
  interactive?: boolean;
}

export function FormattedParentNote({
  noteId,
  title,
  description,
  color = '#0C74E4',
  iconName = 'FileText',
  onToggleCheckbox,
  interactive = true,
}: FormattedParentNoteProps) {
  if (!description && !title) return null;

  const lines = description ? description.split('\n') : [];

  return (
    <Box
      className="formatted-parent-note-block"
      sx={{
        color,
        fontSize: '0.73rem',
        mb: 1,
        pb: 0.5,
        borderBottom: '1px dashed',
        borderColor: 'rgba(255,255,255,0.1)',
        '&:last-child': {
          mb: 0,
          pb: 0,
          borderBottom: 'none',
        },
      }}
    >
      {/* Header — Always Bold */}
      {title && (
        <Box display="flex" alignItems="center" gap={0.5} mb={0.25}>
          <ItemIcon name={iconName} size={11} color={color} />
          <Typography
            variant="caption"
            fontWeight={900}
            className="note-header-title"
            sx={{
              color,
              fontSize: '0.72rem',
              letterSpacing: 0.2,
              display: 'inline-block',
            }}
          >
            {title}
          </Typography>
        </Box>
      )}

      {/* Body Lines — Bullets & Interactive Checkboxes */}
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        if (!trimmed && lineIndex > 0) return null;

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
                cursor: interactive && onToggleCheckbox && noteId ? 'pointer' : 'default',
              }}
              onClick={(e) => {
                if (interactive && onToggleCheckbox && noteId) {
                  e.stopPropagation();
                  onToggleCheckbox(noteId, lineIndex, !checked);
                }
              }}
            >
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
                  color,
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
            <Box key={lineIndex} display="flex" alignItems="flex-start" gap={0.5} sx={{ my: 0.2, lineHeight: 1.3 }}>
              <Box component="span" sx={{ fontSize: '0.8rem', lineHeight: 1, pt: 0.2 }}>
                •
              </Box>
              <Box component="span" sx={{ wordBreak: 'break-word', fontWeight: 500 }}>
                {content}
              </Box>
            </Box>
          );
        }

        // Standard Text Line
        return (
          <Box key={lineIndex} sx={{ my: 0.2, lineHeight: 1.3, wordBreak: 'break-word', fontWeight: 500 }}>
            {!title && lineIndex === 0 && iconName && (
              <ItemIcon name={iconName} size={11} color={color} style={{ marginRight: 4, display: 'inline' }} />
            )}
            {line}
          </Box>
        );
      })}
    </Box>
  );
}
