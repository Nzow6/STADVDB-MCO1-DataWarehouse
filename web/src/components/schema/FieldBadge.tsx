import React from 'react';
import { Plus, Hash, Type, Calendar, Clock, DollarSign } from 'lucide-react';
import { SchemaField } from '../../types/olap';

interface FieldBadgeProps {
  field: SchemaField;
  onAddMeasure?: (field: SchemaField) => void;
  onAddDimension?: (field: SchemaField) => void;
}

export const FieldBadge: React.FC<FieldBadgeProps> = ({
  field,
  onAddMeasure,
  onAddDimension,
}) => {
  const isMeasure = field.category === 'measure';

  const getDataTypeIcon = () => {
    switch (field.dataType) {
      case 'INTEGER':
        return <Hash className="w-3 h-3 text-emerald-700" />;
      case 'NUMERIC':
      case 'DOUBLE':
        return <DollarSign className="w-3 h-3 text-emerald-700" />;
      case 'TIMESTAMP':
        return <Calendar className="w-3 h-3 text-slate-500" />;
      case 'TIME':
        return <Clock className="w-3 h-3 text-slate-500" />;
      default:
        return <Type className="w-3 h-3 text-slate-500" />;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMeasure && onAddMeasure) {
      onAddMeasure(field);
    } else if (!isMeasure && onAddDimension) {
      onAddDimension(field);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group flex items-center justify-between px-2 py-1 my-0.5 rounded text-xs hover:bg-emerald-50 cursor-pointer border border-transparent hover:border-emerald-200 transition"
      title={`Click to add ${field.displayName} to query builder`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="flex-shrink-0">{getDataTypeIcon()}</span>
        <span className="text-slate-700 group-hover:text-slate-900 truncate text-[11px] font-medium">
          {field.displayName || field.name}
        </span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-300">
          {field.dataType}
        </span>
        <button
          className="p-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white"
          title={isMeasure ? 'Add to Measures' : 'Add to Dimensions'}
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};
