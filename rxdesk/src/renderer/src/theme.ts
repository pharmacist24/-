import { createTheme, type MantineThemeOverride } from '@mantine/core'

// Large, calm and readable: busy clinic, often non-technical users.
export const theme: MantineThemeOverride = createTheme({
  primaryColor: 'teal',
  primaryShade: 7,
  fontFamily: "'Cairo', 'Roboto', 'Segoe UI', sans-serif",
  headings: { fontFamily: "'Cairo', 'Roboto', 'Segoe UI', sans-serif", fontWeight: '700' },
  defaultRadius: 'md',
  fontSizes: { xs: '0.8rem', sm: '0.9rem', md: '1rem', lg: '1.12rem', xl: '1.3rem' },
  components: {
    Button: { defaultProps: { size: 'md' } },
    TextInput: { defaultProps: { size: 'md' } },
    NumberInput: { defaultProps: { size: 'md' } },
    PasswordInput: { defaultProps: { size: 'md' } },
    Textarea: { defaultProps: { size: 'md', autosize: true, minRows: 2 } },
    Select: { defaultProps: { size: 'md', allowDeselect: false, comboboxProps: { withinPortal: true } } },
    Autocomplete: { defaultProps: { size: 'md' } },
    SegmentedControl: { defaultProps: { size: 'md' } },
    Checkbox: { defaultProps: { size: 'md' } },
    Switch: { defaultProps: { size: 'md' } },
    Modal: { defaultProps: { centered: true, overlayProps: { backgroundOpacity: 0.35 } } },
    Tooltip: { defaultProps: { openDelay: 350, withArrow: true } }
  }
})
