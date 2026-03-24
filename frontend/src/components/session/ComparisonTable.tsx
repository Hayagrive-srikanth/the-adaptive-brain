'use client';

import Card from '@/components/ui/Card';

interface ComparisonRow {
  label: string;
  values: string[];
}

interface ComparisonTableData {
  columns: string[];
  rows: ComparisonRow[];
}

interface ComparisonTableProps {
  data: ComparisonTableData;
}

export default function ComparisonTable({ data }: ComparisonTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="bg-[#6C63FF]">
              <th className="text-left text-white text-sm font-semibold px-5 py-3.5 first:rounded-tl-xl">
                Concept
              </th>
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  className={`text-left text-white text-sm font-semibold px-5 py-3.5 ${
                    i === data.columns.length - 1 ? 'rounded-tr-xl' : ''
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => {
              const isEven = rowIndex % 2 === 0;
              // Check for differences between values
              const allSame = row.values.every((v) => v === row.values[0]);

              return (
                <tr
                  key={rowIndex}
                  className={`border-b border-gray-100 transition-colors hover:bg-[#6C63FF]/[0.03] ${
                    isEven ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <td className="px-5 py-4 font-medium text-gray-900 text-sm">
                    {row.label}
                  </td>
                  {row.values.map((value, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-5 py-4 text-sm ${
                        !allSame
                          ? 'text-gray-900 font-medium bg-[#FF6B35]/[0.04]'
                          : 'text-gray-600'
                      }`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
