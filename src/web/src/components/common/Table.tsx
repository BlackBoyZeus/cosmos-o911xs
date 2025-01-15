import React, { useState, useMemo, useCallback } from 'react';
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Checkbox,
  Box,
} from '@mui/material';
import { AutoSizer, List } from 'react-virtualized';
import Loading from './Loading';
import { theme } from '../../assets/styles/theme';

// Type definitions
type SortDirection = 'asc' | 'desc';

interface TableColumn<T> {
  key: string;
  title: string;
  dataIndex: string;
  sortable?: boolean;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  resizable?: boolean;
  render?: (value: any, record: T) => React.ReactNode;
  headerCellProps?: object;
  bodyCellProps?: object;
}

interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  data: Array<T>;
  loading?: boolean;
  pagination?: boolean;
  rowsPerPageOptions?: Array<number>;
  onSort?: (column: string, direction: SortDirection) => void;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  virtualize?: boolean;
  stickyHeader?: boolean;
  selectable?: boolean;
  onRowSelect?: (selectedRows: Array<T>) => void;
  ariaLabel?: string;
  resizableColumns?: boolean;
}

const Table = <T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  pagination = true,
  rowsPerPageOptions = [10, 25, 50, 100],
  onSort,
  onPageChange,
  onRowsPerPageChange,
  virtualize = false,
  stickyHeader = true,
  selectable = false,
  onRowSelect,
  ariaLabel = 'Data table',
  resizableColumns = false,
}: TableProps<T>): JSX.Element => {
  // State management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Memoized calculations
  const paginatedData = useMemo(() => {
    if (!pagination) return data;
    const start = page * rowsPerPage;
    return data.slice(start, start + rowsPerPage);
  }, [data, page, rowsPerPage, pagination]);

  // Column resize handler
  const handleColumnResize = useCallback((columnKey: string, width: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [columnKey]: width,
    }));
  }, []);

  // Sort handler
  const handleSort = useCallback((column: string) => {
    const isAsc = sortColumn === column && sortDirection === 'asc';
    const newDirection = isAsc ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(newDirection);
    onSort?.(column, newDirection);
  }, [sortColumn, sortDirection, onSort]);

  // Row selection handlers
  const handleSelectAllClick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = new Set(data.map(row => row.id!));
      setSelectedRows(newSelected);
      onRowSelect?.(data);
    } else {
      setSelectedRows(new Set());
      onRowSelect?.([]);
    }
  }, [data, onRowSelect]);

  const handleRowSelect = useCallback((id: string | number) => {
    setSelectedRows(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      onRowSelect?.(data.filter(row => newSelected.has(row.id!)));
      return newSelected;
    });
  }, [data, onRowSelect]);

  // Pagination handlers
  const handleChangePage = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
    onPageChange?.(newPage);
  }, [onPageChange]);

  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    onRowsPerPageChange?.(newRowsPerPage);
  }, [onRowsPerPageChange]);

  // Virtualized row renderer
  const rowRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = paginatedData[index];
    return (
      <TableRow
        hover
        tabIndex={-1}
        key={row.id}
        style={style}
        selected={selectedRows.has(row.id!)}
      >
        {selectable && (
          <TableCell padding="checkbox">
            <Checkbox
              checked={selectedRows.has(row.id!)}
              onChange={() => handleRowSelect(row.id!)}
            />
          </TableCell>
        )}
        {columns.map(column => (
          <TableCell
            key={column.key}
            {...column.bodyCellProps}
            style={{ width: columnWidths[column.key] || column.width }}
          >
            {column.render ? column.render(row[column.dataIndex as keyof T], row) : row[column.dataIndex as keyof T]}
          </TableCell>
        ))}
      </TableRow>
    );
  }, [paginatedData, columns, selectedRows, selectable, columnWidths, handleRowSelect]);

  if (loading) {
    return <Loading size="large" message="Loading data..." />;
  }

  return (
    <Paper elevation={1}>
      <TableContainer>
        <MuiTable
          aria-label={ariaLabel}
          stickyHeader={stickyHeader}
        >
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedRows.size > 0 && selectedRows.size < data.length}
                    checked={selectedRows.size === data.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {columns.map(column => (
                <TableCell
                  key={column.key}
                  sortDirection={sortColumn === column.key ? sortDirection : false}
                  style={{
                    width: columnWidths[column.key] || column.width,
                    minWidth: column.minWidth,
                    maxWidth: column.maxWidth,
                  }}
                  {...column.headerCellProps}
                >
                  {column.sortable ? (
                    <TableSortLabel
                      active={sortColumn === column.key}
                      direction={sortColumn === column.key ? sortDirection : 'asc'}
                      onClick={() => handleSort(column.key)}
                    >
                      {column.title}
                    </TableSortLabel>
                  ) : column.title}
                  {resizableColumns && column.resizable && (
                    <Box
                      sx={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '4px',
                        cursor: 'col-resize',
                        '&:hover': {
                          backgroundColor: theme.palette.primary.main,
                        },
                      }}
                      onMouseDown={(e) => {
                        const startX = e.pageX;
                        const startWidth = columnWidths[column.key] || 0;
                        
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const newWidth = startWidth + (moveEvent.pageX - startX);
                          handleColumnResize(column.key, newWidth);
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    />
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {virtualize ? (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    width={width}
                    rowCount={paginatedData.length}
                    rowHeight={53}
                    rowRenderer={rowRenderer}
                  />
                )}
              </AutoSizer>
            ) : (
              paginatedData.map(row => rowRenderer({ index: data.indexOf(row), style: {} }))
            )}
          </TableBody>
        </MuiTable>
      </TableContainer>
      {pagination && (
        <TablePagination
          rowsPerPageOptions={rowsPerPageOptions}
          component="div"
          count={data.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}
    </Paper>
  );
};

export default React.memo(Table);
export type { TableProps, TableColumn, SortDirection };