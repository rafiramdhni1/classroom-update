import { useStaff } from './staffStore';
import { Select, LoadingBlock } from '../../components/ui';
import Icon from '../../components/icons';
import toast from '../../components/Toaster';
import { useState } from 'react';
import * as XLSX from 'xlsx-js-style';

export default function GradesMenu() {
  const { KELAS_LIST, addAssignment, gradeAssignments, gradeData, gradeKelas, gradeLoading, gradeSaving, gradeSubject, newAssignment, saveGrades, setGradeKelas, setGradeSubject, setNewAssignment, setShowNewAssignment, showNewAssignment, updateScore } = useStaff();

  const exportToCSV = () => {
    if (!gradeData || gradeData.length === 0) {
      toast.error('Tidak ada data nilai untuk diexport.');
      return;
    }

    const headers = [
      'No',
      'NIS',
      'Nama Siswa',
      'Kelas',
      ...gradeAssignments,
      'Rata-rata',
    ];

    const rows = gradeData.map((sg, idx) => {
      const numGrades = [];
      const scores = gradeAssignments.map((a) => {
        const g = sg.grades.find((gr) => gr.title === a);
        if (g?.score !== undefined && g?.score !== '' && g?.score !== null) {
          const num = Number(g.score);
          numGrades.push(num);
          return num;
        }
        return '-';
      });

      const studentAvg = numGrades.length > 0
        ? Math.round(numGrades.reduce((a, b) => a + b, 0) / numGrades.length)
        : '-';

      return [
        idx + 1,
        sg.student?.nis || '',
        sg.student?.nama || '',
        sg.student?.kelas || gradeKelas || '',
        ...scores,
        studentAvg,
      ];
    });

    const summaryRow = ['', '', 'RATA-RATA KELAS', ''];
    let overallSum = 0;
    let overallCount = 0;

    for (const a of gradeAssignments) {
      let sum = 0;
      let count = 0;
      for (const sg of gradeData) {
        const g = sg.grades.find(gr => gr.title === a);
        if (g && g.score !== '' && g.score !== undefined && g.score !== null) {
          sum += Number(g.score);
          count++;
        }
      }
      const colAvg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
      summaryRow.push(colAvg > 0 ? colAvg : '-');
      if (colAvg > 0) {
        overallSum += colAvg;
        overallCount++;
      }
    }
    const finalClassAvg = overallCount > 0 ? Number((overallSum / overallCount).toFixed(2)) : '-';
    summaryRow.push(finalClassAvg);
    rows.push(summaryRow);

    const escapeCell = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvContent =
      '\uFEFFsep=,\r\n' +
      [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeKelas = (gradeKelas || 'kelas').replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeSubject = (gradeSubject || 'mapel').replace(/[^a-zA-Z0-9-_]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `nilai-${safeSubject}-${safeKelas}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Berhasil export nilai ${gradeSubject} - ${gradeKelas} ke CSV!`);
  };

  const exportToExcel = () => {
    if (!gradeData || gradeData.length === 0) {
      toast.error('Tidak ada data nilai untuk diexport.');
      return;
    }

    const headers = [
      'No',
      'NIS',
      'Nama Siswa',
      'Kelas',
      ...gradeAssignments,
      'Rata-rata',
    ];

    const dataRows = gradeData.map((sg, idx) => {
      const numGrades = [];
      const scores = gradeAssignments.map((a) => {
        const g = sg.grades.find((gr) => gr.title === a);
        if (g?.score !== undefined && g?.score !== '' && g?.score !== null) {
          const num = Number(g.score);
          numGrades.push(num);
          return num;
        }
        return '-';
      });

      const studentAvg = numGrades.length > 0
        ? Math.round(numGrades.reduce((a, b) => a + b, 0) / numGrades.length)
        : '-';

      return [
        idx + 1,
        sg.student?.nis || '',
        sg.student?.nama || '',
        sg.student?.kelas || gradeKelas || '',
        ...scores,
        studentAvg,
      ];
    });

    const summaryRow = ['', '', 'RATA-RATA KELAS', ''];
    let overallSum = 0;
    let overallCount = 0;

    for (const a of gradeAssignments) {
      let sum = 0;
      let count = 0;
      for (const sg of gradeData) {
        const g = sg.grades.find(gr => gr.title === a);
        if (g && g.score !== '' && g.score !== undefined && g.score !== null) {
          sum += Number(g.score);
          count++;
        }
      }
      const colAvg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
      summaryRow.push(colAvg > 0 ? colAvg : '-');
      if (colAvg > 0) {
        overallSum += colAvg;
        overallCount++;
      }
    }
    const finalClassAvg = overallCount > 0 ? Number((overallSum / overallCount).toFixed(2)) : '-';
    summaryRow.push(finalClassAvg);

    const allRows = [headers, ...dataRows, summaryRow];
    const ws = XLSX.utils.aoa_to_sheet(allRows);

    const borderThin = {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    };

    // Header styling
    headers.forEach((_, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1E3A8A' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '1E3A8A' } },
            bottom: { style: 'medium', color: { rgb: '1E3A8A' } },
            left: { style: 'thin', color: { rgb: '3B82F6' } },
            right: { style: 'thin', color: { rgb: '3B82F6' } },
          },
        };
      }
    });

    // Data rows styling
    dataRows.forEach((row, rIdx) => {
      const rowIndex = rIdx + 1;
      const isZebra = rIdx % 2 === 1;

      row.forEach((val, cIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: cIdx });
        if (!ws[cellRef]) return;

        const isNama = cIdx === 2;
        const isAvg = cIdx === row.length - 1;

        let hAlign = 'center';
        if (isNama) hAlign = 'left';

        let fontColor = { rgb: '1E293B' };
        let fontBold = false;
        let bgColor = isZebra ? { rgb: 'F8FAFC' } : { rgb: 'FFFFFF' };

        if (isAvg) {
          fontBold = true;
          fontColor = { rgb: '0F172A' };
          bgColor = isZebra ? { rgb: 'EFF6FF' } : { rgb: 'F0F7FF' };
        } else if (val === '-') {
          fontColor = { rgb: '94A3B8' };
        } else if (typeof val === 'number') {
          fontColor = { rgb: '0F172A' };
        }

        ws[cellRef].s = {
          font: { name: 'Calibri', sz: 10, bold: fontBold, color: fontColor },
          fill: { fgColor: bgColor.rgb ? bgColor : { rgb: 'FFFFFF' } },
          alignment: { horizontal: hAlign, vertical: 'center' },
          border: borderThin,
        };
      });
    });

    // Summary row styling
    const summaryRowIdx = allRows.length - 1;
    summaryRow.forEach((_, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: summaryRowIdx, c: cIdx });
      if (!ws[cellRef]) return;

      ws[cellRef].s = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '1E3A8A' } },
        fill: { fgColor: { rgb: 'E2E8F0' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: '1E3A8A' } },
          bottom: { style: 'double', color: { rgb: '1E3A8A' } },
          left: borderThin.left,
          right: borderThin.right,
        },
      };
    });

    ws['!cols'] = headers.map((h, i) => {
      if (i === 0) return { wch: 6 };
      if (i === 1) return { wch: 12 };
      if (i === 2) return { wch: 32 };
      if (i === 3) return { wch: 12 };
      if (i === headers.length - 1) return { wch: 14 };
      return { wch: Math.max(18, Math.min(45, h.length + 4)) };
    });

    ws['!rows'] = [{ hpt: 32 }, ...dataRows.map(() => ({ hpt: 20 })), { hpt: 24 }];

    const safeKelas = (gradeKelas || 'kelas').replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeSubject = (gradeSubject || 'mapel').replace(/[^a-zA-Z0-9-_]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Nilai ${safeKelas}`);
    XLSX.writeFile(wb, `nilai-${safeSubject}-${safeKelas}-${dateStr}.xlsx`);

    toast.success(`Berhasil export nilai ${gradeSubject} - ${gradeKelas} ke Excel (.xlsx)!`);
  };

  const renderGradeTable = () => {
    if (gradeLoading) {
      return (
        <LoadingBlock
          label="Memuat data nilai..."
          hint="Mengambil daftar nilai siswa"
          className="min-h-[35vh]"
        />
      );
    }
    if (!gradeData.length) {
      return <p className="text-center text-muted text-sm py-8">Tidak ada data siswa untuk kelas ini.</p>;
    }
    return (
      <>
        <div className="table-shell overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr className="bg-surface2">
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted sticky left-0 bg-surface2">Nama</th>
                {gradeAssignments.map((a, i) => (
                  <th key={i} className="px-3 py-2 text-center text-xs font-semibold text-muted min-w-[80px]">{a}</th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-semibold text-muted">Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              {gradeData.map((sg, si) => {
                const scores = gradeAssignments.map(a => {
                  const g = sg.grades.find(gr => gr.title === a);
                  return g && g.score !== '' && g.score !== undefined ? Number(g.score) : null;
                }).filter(s => s !== null);
                const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '-';
                return (
                  <tr key={sg.student._id} className="border-t border-line/80 transition hover:bg-accent/5">
                    <td className="px-3 py-2 sticky left-0 bg-surface hover:bg-surface2">
                      <p className="font-medium text-ink text-xs">{sg.student.nama}</p>
                      <p className="text-xs text-muted">{sg.student.nis}</p>
                    </td>
                    {gradeAssignments.map((a, ai) => {
                      const g = sg.grades.find(gr => gr.title === a);
                      return (
                        <td key={ai} className="px-2 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g?.score ?? ''}
                            onChange={(e) => updateScore(si, a, e.target.value)}
                            className="input w-16 px-1 py-1 text-center text-xs"
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-bold ${
                        avg >= 80 ? 'text-success' : avg >= 60 ? 'text-warn' : typeof avg === 'number' ? 'text-danger' : 'text-muted'
                      }`}>
                        {avg}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface2 font-bold border-t-2 border-line">
                <td className="px-3 py-2 sticky left-0 bg-surface2 text-xs font-bold text-ink">RATA-RATA</td>
                {gradeAssignments.map((a, i) => {
                  let sum = 0;
                  let count = 0;
                  for (const sg of gradeData) {
                    const g = sg.grades.find(gr => gr.title === a);
                    if (g && g.score !== '' && g.score !== undefined && g.score !== null) {
                      sum += Number(g.score);
                      count++;
                    }
                  }
                  const colAvg = count > 0 ? (sum / count).toFixed(2) : '0.00';
                  return (
                    <td key={i} className="px-3 py-2 text-center text-xs font-mono font-bold text-accent">
                      {colAvg}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center bg-surface2 text-xs text-muted">-</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            onClick={saveGrades}
            disabled={gradeSaving}
            className="btn-primary flex-1 py-3"
          >
            {gradeSaving ? 'Menyimpan...' : `Simpan Semua Nilai (${gradeData.length} siswa)`}
          </button>
          <button
            type="button"
            onClick={exportToExcel}
            disabled={!gradeData.length}
            className="btn-soft px-4 py-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-success border-success/30 hover:bg-success/10 disabled:opacity-50 rounded-xl"
            title="Export langsung ke Excel (.xlsx)"
          >
            <Icon name="download" className="h-4 w-4" />
            <span>Export Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={exportToCSV}
            disabled={!gradeData.length}
            className="btn-soft px-4 py-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-muted border-line hover:bg-surface2 disabled:opacity-50 rounded-xl"
            title="Export ke CSV"
          >
            <Icon name="download" className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad space-y-3">
        <h3 className="font-semibold text-ink">Input Nilai Manual</h3>
        <div className="flex gap-2">
          <Select
            className="flex-1"
            icon="classroom"
            value={gradeKelas}
            onChange={setGradeKelas}
            options={KELAS_LIST.map(k => ({ value: k, label: k }))}
            placeholder="Pilih Kelas"
          />
          <Select
            className="flex-1"
            icon="grades"
            value={gradeSubject}
            onChange={setGradeSubject}
            options={['ASJ', 'AIJ', 'TJBL', 'PKDK', 'TJKT'].map(s => ({ value: s, label: s }))}
            placeholder="Pilih Mata Pelajaran"
          />
        </div>
      </div>

      {gradeKelas && gradeSubject && (
        <>
          <div className="card card-pad">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-ink text-sm">Komponen Nilai</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportToCSV}
                  disabled={!gradeData.length}
                  className="btn-soft px-3 py-1.5 text-xs inline-flex items-center gap-1.5 text-success border-success/30 hover:bg-success/10 disabled:opacity-50"
                  title="Export nilai ke CSV untuk Spreadsheet / Excel"
                >
                  <Icon name="download" className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setShowNewAssignment(!showNewAssignment)}
                  className="btn-soft px-3 py-1.5 text-xs"
                >
                  + Tambah
                </button>
              </div>
            </div>

            {showNewAssignment && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Nama (contoh: Tugas 1, UTS, UAS)"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  className="input flex-1"
                />
                <Select
                  className="w-32"
                  icon="edit"
                  value={newAssignment.type}
                  onChange={(v) => setNewAssignment({ ...newAssignment, type: v })}
                  options={[
                    { value: 'tugas', label: 'Tugas' },
                    { value: 'quiz', label: 'Quiz' },
                    { value: 'uts', label: 'UTS' },
                    { value: 'uas', label: 'UAS' },
                  ]}
                />
                <button
                  onClick={addAssignment}
                  className="btn-primary px-3 py-2 text-sm"
                >
                  Tambah
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {gradeAssignments.map((a, i) => (
                <span key={i} className="chip px-2 py-0.5">{a}</span>
              ))}
              {gradeAssignments.length === 0 && (
                <p className="text-xs text-muted">Belum ada komponen. Klik "+ Tambah" untuk menambahkan.</p>
              )}
            </div>
          </div>

          {renderGradeTable()}
        </>
      )}

      {!gradeKelas || !gradeSubject ? (
        <p className="text-center text-muted text-sm py-8">Pilih kelas dan mata pelajaran untuk mulai input nilai.</p>
      ) : null}
    </div>
  );
}