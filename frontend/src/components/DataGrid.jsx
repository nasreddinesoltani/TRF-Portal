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
  PdfExport,
} from "@syncfusion/ej2-react-grids";

const generateGridId = () => `grid-${Math.random().toString(36).slice(2, 9)}`;
const DEFAULT_PAGE_SIZE = 12;

export const DataGrid = React.forwardRef(
  (
    {
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
      showExport = true,
      showColumnChooser = true,
      rowHeight = 100,
      showPdfExport = false,
    },
    ref
  ) => {
    const internalGridRef = useRef(null);
    const resolvedGridId = useMemo(() => gridId || generateGridId(), [gridId]);

    // Expose the internal grid instance and export methods
    // Use a getter-based approach so methods are resolved at call time, not at ref creation time
    React.useImperativeHandle(ref, () => ({
      get columns() {
        return internalGridRef.current?.columns;
      },
      excelExport: (...args) => {
        if (internalGridRef.current?.excelExport) {
          return internalGridRef.current.excelExport(...args);
        }
        console.warn('Grid excelExport not available');
      },
      pdfExport: (...args) => {
        if (internalGridRef.current?.pdfExport) {
          return internalGridRef.current.pdfExport(...args);
        }
        console.warn('Grid pdfExport not available');
      },
      getGridInstance: () => internalGridRef.current,
    }));

  const resolvedPageSize = useMemo(() => {
    const candidate = Number(pageSize);
    return Number.isFinite(candidate) && candidate > 0
      ? Math.trunc(candidate)
      : DEFAULT_PAGE_SIZE;
  }, [pageSize]);

  const pagerTemplate = useCallback((props) => {
    // Syncfusion pager template props: currentPage, pageSize, pageCount (total pages), totalRecordsCount
    const { 
      currentPage = 1, 
      totalPages = 1, 
      totalRecordsCount = 0, 
      pageSize = resolvedPageSize || 10 
    } = props;
    const start = totalRecordsCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    const end = Math.min(currentPage * pageSize, totalRecordsCount);

    const handlePageSizeChange = (e) => {
      if (internalGridRef.current) {
        internalGridRef.current.pageSettings.pageSize = parseInt(e.target.value, 10);
      }
    };

    const goToPage = (num) => {
      if (internalGridRef.current) {
        internalGridRef.current.goToPage(num);
      }
    };

    return (
      <div className="flex w-full flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4">
        <div className="text-sm text-slate-500">
          Showing <span className="font-medium text-slate-900">{start}</span> to{" "}
          <span className="font-medium text-slate-900">{end}</span> of{" "}
          <span className="font-medium text-slate-900">{totalRecordsCount}</span>{" "}
          results
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Rows per page</span>
            <select
              className="h-8 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={pageSize}
              onChange={handlePageSizeChange}
            >
              {[5, 10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
              title="Previous Page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span className="min-w-[4rem] text-center text-sm font-medium text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
              title="Next Page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }, []);

  const pageSettings = useMemo(
    () => ({
      pageSize: resolvedPageSize,
      template: pagerTemplate,
    }),
    [resolvedPageSize, pagerTemplate]
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
      const items = [];
      if (showSearch) items.push("Search");
      if (showColumnChooser) items.push("ColumnChooser");
      if (showExport) items.push("ExcelExport");
      if (showPdfExport) items.push("PdfExport");
      return items.length > 0 ? items : undefined;
    },
    [showSearch, showExport, showColumnChooser, showPdfExport]
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
      internalGridRef.current?.excelExport();
    } else if (args.item?.id === `${resolvedGridId}_pdfexport`) {
      internalGridRef.current?.pdfExport();
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
        ref={internalGridRef}
        id={resolvedGridId}
        dataSource={data}
        allowPaging
        allowSorting
        allowFiltering
        allowResizing
        allowExcelExport
        allowPdfExport
        showColumnChooser
        gridLines="Horizontal"
        rowHeight={rowHeight}
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
            PdfExport,
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
}
);
