import React from "react";
import { Button } from "./ui/button";

export const ActionButtons = ({ rowData, onEdit, onDelete }) => {
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onEdit(rowData)}
        className="px-3 py-1 text-xs"
      >
        Edit
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => onDelete(rowData.id)}
        className="px-3 py-1 text-xs"
      >
        Delete
      </Button>
    </div>
  );
};
