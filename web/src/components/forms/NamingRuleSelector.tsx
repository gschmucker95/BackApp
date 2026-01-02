import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { namingRuleApi } from '../../api';
import type { NamingRule } from '../../types';

interface NamingRuleSelectorProps {
  namingRules: NamingRule[];
  value: number | '';
  onChange: (ruleId: number) => void;
  showPattern?: boolean;
  showPreview?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  label?: string;
  placeholder?: string;
  helperText?: string;
}

export function NamingRuleSelector({
  namingRules,
  value,
  onChange,
  showPattern = false,
  showPreview = false,
  required = true,
  fullWidth = true,
  label = 'Naming Rule',
  placeholder = 'Select naming rule',
  helperText,
}: NamingRuleSelectorProps) {
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    if (showPreview && value) {
      updatePreview(value);
    }
  }, [value, showPreview]);

  const updatePreview = async (ruleId: number) => {
    try {
      const rule = namingRules.find((r) => r.id === ruleId);
      if (rule) {
        const previewText = await namingRuleApi.translate(rule.pattern);
        setPreview(previewText);
      }
    } catch (error) {
      console.error('Error translating naming rule:', error);
      setPreview('');
    }
  };

  return (
    <Box>
      <TextField
        fullWidth={fullWidth}
        select
        label={label}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        required={required}
        helperText={helperText}
      >
        <MenuItem value="">{placeholder}</MenuItem>
        {namingRules.map((rule) => (
          <MenuItem key={rule.id} value={rule.id}>
            {showPattern ? (
              <Stack direction="column" spacing={0.25}>
                <Typography variant="body2">{rule.name}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {rule.pattern}
                </Typography>
              </Stack>
            ) : (
              rule.name
            )}
          </MenuItem>
        ))}
      </TextField>
      {showPreview && preview && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 0.5 }}>
          Preview: <code>{preview}</code>
        </Typography>
      )}
    </Box>
  );
}
