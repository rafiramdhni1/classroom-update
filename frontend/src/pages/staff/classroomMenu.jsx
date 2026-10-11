import { useStaff } from './staffStore';
import api from '../../utils/api';
import { Select, LoadingBlock } from '../../components/ui';
import Icon from '../../components/icons';
import toast from '../../components/Toaster';
import * as XLSX from 'xlsx-js-style';

function ClassroomTable({ classroomData, classroomCourseworks = [], onExport, onExportExcel }) {
  const cwList = classroomCourseworks.length > 0
    ? classroomCourseworks
    : [...new Set(classroomData.flatMap(sg => sg.submissions.map(s => s.title)))].map(title => ({ title, workType: 'ASSIGNMENT', maxPoints: 100 }));

  const validStudentsCount = classroomData.filter(sg => !!sg.student?.classroomId).length;

  return (
    <div className="space-y-3">
      {(onExport || onExportExcel) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted">
            Menampilkan <span className="font-semibold text-ink">{classroomData.length}</span> siswa & <span className="font-semibold text-ink">{cwList.length}</span> tugas
          </p>
          <div className="flex items-center gap-2">
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="btn-soft px-3 py-1.5 text-xs inline-flex items-center gap-1.5 text-success border-success/30 hover:bg-success/10"
                title="Export nilai langsung ke Excel (.xlsx)"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                <span>Export Excel (.xlsx)</span>
              </button>
            )}
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="btn-soft px-3 py-1.5 text-xs inline-flex items-center gap-1.5 text-muted border-line hover:bg-surface2"
                title="Export nilai ke CSV (Format Google Sheets / Excel)"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      )}
      <div className="table-shell overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr className="bg-surface2">
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted sticky left-0 bg-surface2">Nama</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">NIS</th>
            {cwList.map((cw, i) => (
              <th key={i} className="px-3 py-2 text-center text-xs font-semibold text-muted min-w-[100px]" title={`${cw.title} (${cw.workType || 'ASSIGNMENT'}) [${cw.maxPoints || 100}]`}>
                <span className="block truncate max-w-[140px]">{cw.title}</span>
                <span className="text-[10px] text-muted/70 font-normal">[{cw.maxPoints || 100}]</span>
              </th>
            ))}
            <th className="px-3 py-2 text-center text-xs font-semibold text-muted bg-surface2">Rata-rata</th>
          </tr>
        </thead>
        <tbody>
          {classroomData.map(sg => {
            const hasClassroom = !!sg.student?.classroomId;
            const grades = cwList.map(cw => {
              if (!hasClassroom) return 'NO_ID';
              const sub = sg.submissions.find(s => s.title === cw.title);
              return sub?.grade !== undefined && sub?.grade !== null ? Number(sub.grade) : null;
            });
            const validGrades = grades.filter(g => typeof g === 'number');
            const avg = validGrades.length > 0 ? Math.round(validGrades.reduce((a, b) => a + b, 0) / validGrades.length) : null;
            return (
              <tr key={sg.student._id} className="border-t border-line/80 transition hover:bg-accent/5">
                <td className="px-3 py-2 sticky left-0 bg-surface hover:bg-surface2">
                  <p className="font-medium text-ink text-xs">{sg.student.nama}</p>
                </td>
                <td className="px-3 py-2 text-xs font-mono">{sg.student.nis}</td>
                {grades.map((grade, i) => (
                  <td key={i} className="px-3 py-2 text-center whitespace-nowrap">
                    {grade === 'NO_ID' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-danger-soft text-danger">NO ID</span>
                    ) : grade !== null ? (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        grade >= 80 ? 'bg-success-soft text-success-ink' :
                        grade >= 60 ? 'bg-warn-soft text-warn-ink' :
                        'bg-danger-soft text-danger-ink'
                      }`}>{grade}</span>
                    ) : (
                      <span className="text-xs text-muted">-</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-center bg-surface2">
                  {avg !== null ? (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      avg >= 80 ? 'bg-success-soft text-success-ink' :
                      avg >= 60 ? 'bg-warn-soft text-warn-ink' :
                      'bg-danger-soft text-danger-ink'
                    }`}>{avg}</span>
                  ) : (
                    <span className="text-xs text-muted">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-surface2 font-bold border-t-2 border-line">
            <td className="px-3 py-2 sticky left-0 bg-surface2 text-xs font-bold text-ink">RATA-RATA</td>
            <td className="px-3 py-2 text-xs text-muted"></td>
            {cwList.map((cw, i) => {
              let sum = 0;
              for (const sg of classroomData) {
                if (sg.student?.classroomId) {
                  const sub = sg.submissions.find(s => s.title === cw.title);
                  if (sub?.grade !== undefined && sub?.grade !== null) sum += Number(sub.grade);
                }
              }
              const colAvg = validStudentsCount > 0 ? (sum / validStudentsCount).toFixed(2) : '0.00';
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
  </div>
  );
}

function LoadingSpinner() {
  return (
    <LoadingBlock
      label="Memuat data Google Classroom..."
      hint="Mengambil nilai dan riwayat tugas siswa"
      className="min-h-[35vh]"
    />
  );
}

function EmptyState() {
  return <p className="text-center text-muted text-sm py-8">Tidak ada data untuk kelas dan mata pelajaran ini.</p>;
}

function SelectMessage() {
  return <p className="text-center text-muted text-sm py-8">Pilih kelas dan pilih kelas Google Classroom untuk melihat nilai.</p>;
}

export default function ClassroomMenu() {
  const { KELAS_LIST, classroomCourseworks, classroomData, classroomKelas, classroomLastSync, classroomLoading, classroomSubject, classroomSubjects, loadClassroomGrades, loadClassroomSubjects, setClassroomKelas, setClassroomLoading, setClassroomSubject } = useStaff();

  const courseOptions = [];
  [...new Set(classroomSubjects.map(s => s.alias))].sort().forEach(alias => {
    courseOptions.push({ header: alias });
    classroomSubjects
      .filter(s => s.alias === alias)
      .forEach(s => courseOptions.push({
        value: s._id,
        label: s.kelas.length > 0 ? s.kelas.join(', ') : s.courseName,
      }));
  });

  const exportClassroomToCSV = () => {
    if (!classroomData || classroomData.length === 0) {
      toast.error('Tidak ada data nilai Google Classroom untuk diexport.');
      return;
    }

    const cwList = classroomCourseworks.length > 0 
      ? classroomCourseworks 
      : [...new Set(classroomData.flatMap(sg => sg.submissions.map(s => s.title)))].map(title => ({ title, workType: 'ASSIGNMENT', maxPoints: 100 }));

    const chosen = classroomSubjects.find(s => s._id === classroomSubject);
    const subjectAlias = chosen ? (chosen.alias || chosen.courseName || 'AIJ') : 'AIJ';

    const cleanCwTitles = cwList.map(cw => {
      let t = (cw.title || 'Tugas').replace(/\s*\(ASSIGNMENT\)\s*/gi, ' ').trim();
      if (cw.maxPoints && cw.maxPoints !== 100) t += ` [Maks ${cw.maxPoints}]`;
      return t;
    });

    const headers = [
      'No',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Status Akun',
      ...cleanCwTitles,
      'Rata-rata',
    ];

    const rows = classroomData.map((sg, idx) => {
      const hasClassroom = !!sg.student?.classroomId;
      const numGrades = [];
      const scoreCols = cwList.map(cw => {
        if (!hasClassroom) return '-';
        const sub = sg.submissions.find(s => s.title === cw.title);
        if (sub?.grade !== undefined && sub?.grade !== null && sub?.grade !== '') {
          const num = Number(sub.grade);
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
        sg.student?.kelas || classroomKelas || '',
        hasClassroom ? 'Terhubung' : 'Belum Terhubung',
        ...scoreCols,
        studentAvg,
      ];
    });

    // Summary row
    const summaryRow = ['', '', 'RATA-RATA KELAS', '', ''];
    let overallSum = 0;
    let overallCount = 0;
    for (const cw of cwList) {
      let sum = 0;
      let count = 0;
      for (const sg of classroomData) {
        if (sg.student?.classroomId) {
          const sub = sg.submissions.find(s => s.title === cw.title);
          if (sub?.grade !== undefined && sub?.grade !== null && sub?.grade !== '') {
            sum += Number(sub.grade);
            count++;
          }
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
      [headers.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeKelas = (classroomKelas || 'kelas').replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeSubject = subjectAlias.replace(/[^a-zA-Z0-9-_]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `classroom-${safeSubject}-${safeKelas}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Berhasil export nilai Classroom (${classroomKelas}) ke CSV!`);
  };

  const exportClassroomToExcel = () => {
    if (!classroomData || classroomData.length === 0) {
      toast.error('Tidak ada data nilai Google Classroom untuk diexport.');
      return;
    }

    const cwList = classroomCourseworks.length > 0 
      ? classroomCourseworks 
      : [...new Set(classroomData.flatMap(sg => sg.submissions.map(s => s.title)))].map(title => ({ title, workType: 'ASSIGNMENT', maxPoints: 100 }));

    const chosen = classroomSubjects.find(s => s._id === classroomSubject);
    const subjectAlias = chosen ? (chosen.alias || chosen.courseName || 'AIJ') : 'AIJ';

    const cleanCwTitles = cwList.map(cw => {
      let t = (cw.title || 'Tugas').replace(/\s*\(ASSIGNMENT\)\s*/gi, ' ').trim();
      if (cw.maxPoints && cw.maxPoints !== 100) t += ` [Maks ${cw.maxPoints}]`;
      return t;
    });

    const headers = [
      'No',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Status Akun',
      ...cleanCwTitles,
      'Rata-rata',
    ];

    const dataRows = classroomData.map((sg, idx) => {
      const hasClassroom = !!sg.student?.classroomId;
      const numGrades = [];
      const scoreCols = cwList.map(cw => {
        if (!hasClassroom) return '-';
        const sub = sg.submissions.find(s => s.title === cw.title);
        if (sub?.grade !== undefined && sub?.grade !== null && sub?.grade !== '') {
          const num = Number(sub.grade);
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
        sg.student?.kelas || classroomKelas || '',
        hasClassroom ? 'Terhubung' : 'Belum Terhubung',
        ...scoreCols,
        studentAvg,
      ];
    });

    // Summary Row
    const summaryRow = ['', '', 'RATA-RATA KELAS', '', ''];
    let overallSum = 0;
    let overallCount = 0;

    for (const cw of cwList) {
      let sum = 0;
      let count = 0;
      for (const sg of classroomData) {
        if (sg.student?.classroomId) {
          const sub = sg.submissions.find(s => s.title === cw.title);
          if (sub?.grade !== undefined && sub?.grade !== null && sub?.grade !== '') {
            sum += Number(sub.grade);
            count++;
          }
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
      const isUnlinked = row[4] === 'Belum Terhubung';

      row.forEach((val, cIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: cIdx });
        if (!ws[cellRef]) return;

        const isNama = cIdx === 2;
        const isStatus = cIdx === 4;
        const isAvg = cIdx === row.length - 1;

        let hAlign = 'center';
        if (isNama) hAlign = 'left';

        let fontColor = { rgb: '1E293B' };
        let fontBold = false;
        let bgColor = isZebra ? { rgb: 'F8FAFC' } : { rgb: 'FFFFFF' };

        if (isStatus) {
          if (isUnlinked) {
            fontColor = { rgb: 'DC2626' };
            bgColor = { rgb: 'FEF2F2' };
          } else {
            fontColor = { rgb: '16A34A' };
          }
        } else if (isAvg) {
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
      if (i === 4) return { wch: 18 };
      if (i === headers.length - 1) return { wch: 14 };
      return { wch: Math.max(18, Math.min(45, h.length + 4)) };
    });

    ws['!rows'] = [{ hpt: 32 }, ...dataRows.map(() => ({ hpt: 20 })), { hpt: 24 }];

    const safeKelas = (classroomKelas || 'kelas').replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeSubject = subjectAlias.replace(/[^a-zA-Z0-9-_]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Nilai ${safeKelas}`);
    XLSX.writeFile(wb, `classroom-${safeSubject}-${safeKelas}-${dateStr}.xlsx`);
    toast.success(`Berhasil export nilai Classroom (${classroomKelas}) ke Excel (.xlsx)!`);
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad space-y-3">
        <h3 className="font-semibold text-ink">Nilai dari Google Classroom</h3>
        <div className="flex gap-2">
          <Select
            className="flex-1"
            icon="classroom"
            value={classroomKelas}
            onChange={setClassroomKelas}
            options={KELAS_LIST.map(k => ({ value: k, label: k }))}
            placeholder="Pilih Kelas"
          />
          <Select
            className="flex-1"
            icon="google"
            value={classroomSubject}
            onChange={(v) => {
              setClassroomSubject(v);
              const chosen = classroomSubjects.find(s => s._id === v);
              if (chosen && chosen.kelas?.length === 1) setClassroomKelas(chosen.kelas[0]);
            }}
            options={courseOptions}
            placeholder="Pilih Kelas Google Classroom"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">
            Data real-time dari Google Classroom
            {classroomLastSync && ` • Update: ${classroomLastSync.toLocaleTimeString('id-ID')}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              setClassroomLoading(true);
              try {
                await api.post('/auth/google/sync');
                toast.success('Sinkronisasi Google Classroom berhasil!\nKelas & nilai terbaru sudah dimuat.');
                if (classroomKelas && classroomSubject) {
                  await Promise.all([loadClassroomSubjects(), loadClassroomGrades()]);
                } else {
                  await loadClassroomSubjects();
                }
              } catch (err) {
                toast.error('Gagal sync: ' + (err.response?.data?.error || err.message));
              } finally {
                setClassroomLoading(false);
              }
            }}
            disabled={classroomLoading}
            className="bg-success text-white px-3 py-1.5 rounded-lg font-medium hover:brightness-95 text-xs disabled:opacity-50"
          >
            {classroomLoading ? 'Syncing...' : 'Sync Google Classroom'}
          </button>
          <button
            onClick={() => loadClassroomGrades(false)}
            disabled={classroomLoading || !classroomKelas || !classroomSubject}
            className="bg-info text-white px-3 py-1.5 rounded-lg font-medium hover:brightness-95 text-xs disabled:opacity-50"
          >
            {classroomLoading ? 'Loading...' : 'Refresh'}
          </button>
          {classroomKelas && classroomSubject && classroomData.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={exportClassroomToExcel}
                className="btn-soft px-3 py-1.5 text-xs inline-flex items-center gap-1.5 text-success border-success/30 hover:bg-success/10"
                title="Export nilai langsung ke Excel (.xlsx)"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                <span>Export Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={exportClassroomToCSV}
                className="btn-soft px-3 py-1.5 text-xs inline-flex items-center gap-1.5 text-muted border-line hover:bg-surface2"
                title="Export nilai ke CSV"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {classroomKelas && classroomSubject ? (
        <div>
          {classroomLoading ? (
            <LoadingSpinner />
          ) : classroomData.length > 0 ? (
            <ClassroomTable
              classroomData={classroomData}
              classroomCourseworks={classroomCourseworks}
              onExport={exportClassroomToCSV}
              onExportExcel={exportClassroomToExcel}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      ) : (
        <SelectMessage />
      )}
    </div>
  );
}