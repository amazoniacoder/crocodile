import React, { useRef } from 'react';
import { Icon } from '../../icons/components';

export interface FileUploadProps {
  accept?: string;
  onFileSelect: (files: FileList | null) => void;
  multiple?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept, onFileSelect, multiple = false, disabled = false, children, className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`file-upload ${className}`}>
      <input ref={fileInputRef} type="file" accept={accept} multiple={multiple}
        disabled={disabled} onChange={e => onFileSelect(e.target.files)}
        style={{ display: 'none' }} />
      {children || (
        <button className="button button--secondary"
          onClick={() => fileInputRef.current?.click()} disabled={disabled}>
          <Icon name="upload" size={16} /> Выбрать файл
        </button>
      )}
    </div>
  );
};
