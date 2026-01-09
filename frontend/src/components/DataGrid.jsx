import React, { useCallback, useMemo, useRef } from "react";
import {
  GridComponent,
  ColumnsDirective,
  ColumnDirective,
  Inject,
  Page,
  Search,
  Selection,
  Toolbar,
  ExcelExport,
  ColumnChooser,
  Filter,
  Sort,
  Resize,
  RowDD,
} from "@syncfusion/ej2-react-grids";

const generateGridId = () => `grid-${Math.random().toString(36).slice(2, 9)}`;
const DEFAULT_PAGE_SIZE = 12;

export const DataGrid = ({
  data,
  columns,
  gridId,
  emptyMessage,
  loading = false,
  showSearch = true,
  pageSize = DEFAULT_PAGE_SIZE,
  onRowSelected,
  onRowDeselected,
  selectionType = "Single",
  selectionMode = "Row",
  allowRowDragAndDrop = false,
  onRowDrop,
  rowDropTargetID,
}) => {
  const gridRef = useRef(null);
  const resolvedGridId = useMemo(() => gridId || generateGridId(), [gridId]);

  const resolvedPageSize = useMemo(() => {
    const candidate = Number(pageSize);
    return Number.isFinite(candidate) && candidate > 0
      ? Math.trunc(candidate)
      : DEFAULT_PAGE_SIZE;
  }, [pageSize]);

  const pageSettings = useMemo(
    () => ({
      pageSize: resolvedPageSize,
      pageSizes: [resolvedPageSize, resolvedPageSize * 2, resolvedPageSize * 4],
      pageCount: 3,
    }),
    [resolvedPageSize]
  );

  const selectionSettings = useMemo(
    () => ({
      type: selectionType,
      mode: selectionMode,
    }),
    [selectionMode, selectionType]
  );

  const filterSettings = useMemo(
    () => ({
      type: "Excel",
      showFilterBarStatus: false,
    }),
    []
  );

  const textWrapSettings = useMemo(
    () => ({
      wrapMode: "Content",
    }),
    []
  );

  const toolbarItems = useMemo(
    () => {
      const items = ["ColumnChooser", "ExcelExport"];
      if (showSearch) items.unshift("Search");
      return items;
    },
    [showSearch]
  );

  const emptyRecordTemplate = useMemo(
    () => () =>
      (
        <div className="py-10 text-sm text-gray-500 text-center">
          {emptyMessage || "No records found"}
        </div>
      ),
    [emptyMessage]
  );

  const toolbarClick = (args) => {
    if (args.item?.id === `${resolvedGridId}_excelexport`) {
      gridRef.current?.excelExport();
    }
  };

  const handleRowSelected = useCallback(
    (args) => {
      if (onRowSelected) {
        onRowSelected(args?.data ?? null);
      }
    },
    [onRowSelected]
  );

  const handleRowDeselected = useCallback(
    (args) => {
      if (onRowDeselected) {
        onRowDeselected(args?.data ?? null);
      }
    },
    [onRowDeselected]
  );

  return (
    <div className="relative">
      <GridComponent
        ref={gridRef}
        id={resolvedGridId}
        dataSource={data}
        allowPaging
        allowSorting
        allowFiltering
        allowResizing
        allowExcelExport
        showColumnChooser
        gridLines="Horizontal"
        rowHeight={100}
        toolbar={toolbarItems}
        toolbarClick={toolbarClick}
        pageSettings={pageSettings}
        filterSettings={filterSettings}
        selectionSettings={selectionSettings}
        textWrapSettings={textWrapSettings}
        height="auto"
        width="100%"
        enableAdaptiveUI={false}
        enablePersistence={false}
        enableRtl={false}
        emptyRecordTemplate={emptyRecordTemplate}
        rowSelected={onRowSelected ? handleRowSelected : undefined}
        rowDeselected={onRowDeselected ? handleRowDeselected : undefined}
        allowRowDragAndDrop={allowRowDragAndDrop}
        rowDrop={onRowDrop}
        rowDropSettings={
          rowDropTargetID ? { targetID: rowDropTargetID } : undefined
        }
      >
        <ColumnsDirective>
          {columns.map((column) => {
            const { template, key, ...rest } = column;
            const columnKey =
              column.field || key || column.headerText || "column";
            return (
              <ColumnDirective
                key={columnKey}
                {...rest}
                template={
                  typeof template === "function"
                    ? (props) => template(props)
                    : undefined
                }
              />
            );
          })}
        </ColumnsDirective>
        <Inject
          services={[
            Page,
            Search,
            Selection,
            Toolbar,
            ExcelExport,
            ColumnChooser,
            Filter,
            Sort,
            Resize,
            RowDD,
          ]}
        />
      </GridComponent>

      {loading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/75 backdrop-blur-sm">
          <span className="text-sm font-medium text-gray-600">
            Loading records…
          </span>
        </div>
      )}
    </div>
  );
};
