import React, { useCallback, useRef, useState } from 'react';
import { Select, MenuItem, SelectChangeEvent, InputBase } from '@mui/material';
import { styled } from '@mui/material/styles';
import { KeyboardArrowDown } from '@mui/icons-material';
import { useVirtual } from 'react-virtual';
import { palette, components } from '../assets/styles/theme';
import debounce from 'lodash/debounce';

// Type definitions
interface OptionType {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface DropdownProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: OptionType[];
  multiple?: boolean;
  searchable?: boolean;
  loading?: boolean;
  virtualized?: boolean;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  className?: string;
  renderOption?: (option: OptionType) => React.ReactNode;
  onSearch?: (query: string) => void;
  'aria-label'?: string;
  maxHeight?: number;
}

// Styled components
const StyledSelect = styled(Select)(({ theme }) => ({
  borderRadius: '0.375rem',
  backgroundColor: theme.palette.background.paper,
  minWidth: '200px',
  transition: 'all 0.2s ease-in-out',
  
  '& .MuiSelect-select': {
    padding: '8px 14px',
    minHeight: '42px',
    display: 'flex',
    alignItems: 'center',
  },

  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.grey[300],
    transition: 'border-color 0.2s ease',
  },

  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.primary.main,
  },

  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.primary.main,
    borderWidth: '2px',
  },

  '&.Mui-error .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.error.main,
  },

  '&.Mui-disabled': {
    backgroundColor: theme.palette.grey[100],
    opacity: 0.7,
    cursor: 'not-allowed',
  },

  '& .MuiSelect-icon': {
    transition: 'transform 0.2s ease',
    '&.open': {
      transform: 'rotate(180deg)',
    },
  },
}));

const SearchInput = styled(InputBase)(({ theme }) => ({
  padding: '8px 14px',
  width: '100%',
  '& input': {
    padding: 0,
    fontSize: '0.875rem',
  },
}));

const VirtualizedMenuList = React.forwardRef<HTMLDivElement, any>((props, ref) => {
  const { children, ...other } = props;
  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtual({
    size: React.Children.count(children),
    parentRef,
    estimateSize: useCallback(() => 42, []),
    overscan: 5,
  });

  return (
    <div {...other} ref={ref}>
      <div
        ref={parentRef}
        style={{ height: Math.min(42 * 6.5, 42 * React.Children.count(children)) }}
      >
        <div
          style={{
            height: `${rowVirtualizer.totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.virtualItems.map((virtualRow) => (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {React.Children.toArray(children)[virtualRow.index]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  options,
  multiple = false,
  searchable = false,
  loading = false,
  virtualized = false,
  placeholder = 'Select option',
  disabled = false,
  error = false,
  helperText,
  className,
  renderOption,
  onSearch,
  'aria-label': ariaLabel,
  maxHeight = 300,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      onSearch?.(query);
    }, 300),
    [onSearch]
  );

  const handleChange = (event: SelectChangeEvent<unknown>) => {
    if (disabled) return;
    onChange(event.target.value as string | string[]);
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const filteredOptions = searchable
    ? options.filter((option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const renderValue = (selected: unknown) => {
    if (multiple) {
      const selectedValues = selected as string[];
      return selectedValues
        .map((val) => options.find((opt) => opt.value === val)?.label)
        .join(', ');
    }
    return options.find((opt) => opt.value === selected)?.label || placeholder;
  };

  return (
    <StyledSelect
      value={value}
      onChange={handleChange}
      multiple={multiple}
      disabled={disabled}
      error={error}
      className={className}
      displayEmpty
      renderValue={renderValue}
      onOpen={() => setOpen(true)}
      onClose={() => {
        setOpen(false);
        setSearchQuery('');
      }}
      IconComponent={(props) => (
        <KeyboardArrowDown {...props} className={open ? 'open' : ''} />
      )}
      MenuProps={{
        PaperProps: {
          style: { maxHeight },
        },
        MenuListProps: {
          component: virtualized ? VirtualizedMenuList : 'ul',
        },
      }}
      aria-label={ariaLabel}
    >
      {searchable && (
        <MenuItem
          dense
          disableRipple
          style={{ cursor: 'default' }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <SearchInput
            autoFocus
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearch}
            onClick={(e) => e.stopPropagation()}
          />
        </MenuItem>
      )}
      
      {filteredOptions.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {option.icon}
          {renderOption ? renderOption(option) : option.label}
        </MenuItem>
      ))}
      
      {loading && (
        <MenuItem disabled>
          Loading...
        </MenuItem>
      )}
      
      {filteredOptions.length === 0 && !loading && (
        <MenuItem disabled>
          No options available
        </MenuItem>
      )}
    </StyledSelect>
  );
};

export default Dropdown;