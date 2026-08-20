import type { FC } from 'react';
import {
  FileText,
  CheckSquare,
  Edit3,
  Sparkles,
  Star,
  BookOpen,
  Bookmark,
  Tag,
  Flag,
  Calendar,
  CheckCircle,
  FileEdit,
  MessageSquare,
} from 'lucide-react';

interface ItemIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export const ItemIcon: FC<ItemIconProps> = ({ name, size = 16, color, style }) => {
  const iconProps = { size, color, style };

  switch (name) {
    case 'none':
      return null;
    case 'FileText':
      return <FileText {...iconProps} />;
    case 'CheckSquare':
      return <CheckSquare {...iconProps} />;
    case 'CheckCircle':
      return <CheckCircle {...iconProps} />;
    case 'Edit3':
      return <Edit3 {...iconProps} />;
    case 'FileEdit':
      return <FileEdit {...iconProps} />;
    case 'MessageSquare':
      return <MessageSquare {...iconProps} />;
    case 'Sparkles':
      return <Sparkles {...iconProps} />;
    case 'Star':
      return <Star {...iconProps} />;
    case 'BookOpen':
      return <BookOpen {...iconProps} />;
    case 'Bookmark':
      return <Bookmark {...iconProps} />;
    case 'Tag':
      return <Tag {...iconProps} />;
    case 'Flag':
      return <Flag {...iconProps} />;
    case 'Calendar':
      return <Calendar {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
};
