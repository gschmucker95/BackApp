import { TextField } from '@mui/material';

interface ProfileNameTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  fullWidth?: boolean;
  label?: string;
  placeholder?: string;
  helperText?: string;
}

export function ProfileNameTextField({
  value,
  onChange,
  required = true,
  fullWidth = true,
  label = 'Profile Name',
  placeholder,
  helperText,
}: ProfileNameTextFieldProps) {
  return (
    <TextField
      fullWidth={fullWidth}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      placeholder={placeholder}
      helperText={helperText}
    />
  );
}
