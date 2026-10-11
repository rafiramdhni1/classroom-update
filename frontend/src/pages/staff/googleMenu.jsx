import { useStaff } from './staffStore';
import Icon from '../../components/icons';

export default function GoogleMenu() {
  const { connectGoogle, disconnectGoogle, googleAuth, googleEmail, syncClassroom, syncResult, syncStudents, syncStudentsResult, syncing, syncingStudents } = useStaff();
  return (
<div className="card card-pad space-y-4">
  <h3 className="font-semibold text-ink">Google Classroom Sync</h3>

  {!googleAuth ? (
    <div className="text-center space-y-3">
      <p className="text-sm text-muted">
        Hubungkan akun Google Guru untuk mengakses Google Classroom.
      </p>
      <button
        onClick={connectGoogle}
        className="inline-flex items-center justify-center gap-1.5 bg-info text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:brightness-95"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Hubungkan dengan Google
      </button>
    </div>
  ) : (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-success">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-medium">Terhubung dengan Google Classroom</span>
      </div>
      <p className="text-xs text-muted -mt-1">
        Terhubung sebagai {googleEmail || 'akun Google Anda'}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          onClick={syncClassroom}
          disabled={syncing}
          className="btn-primary text-xs px-3.5 py-2 inline-flex items-center gap-1.5 shadow-sm rounded-xl disabled:opacity-50"
        >
          <Icon name="refresh" className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Menyinkronkan...' : 'Sinkronisasi Sekarang'}</span>
        </button>

        <button
          onClick={syncStudents}
          disabled={syncingStudents}
          className="btn-soft text-xs px-3.5 py-2 inline-flex items-center gap-1.5 rounded-xl disabled:opacity-50"
        >
          <Icon name="students" className={`h-3.5 w-3.5 ${syncingStudents ? 'animate-spin' : ''}`} />
          <span>{syncingStudents ? 'Menyinkronkan Siswa...' : 'Sinkronkan ID Siswa dari Google Classroom'}</span>
        </button>

        <button
          onClick={disconnectGoogle}
          className="btn-danger text-xs px-3.5 py-2 inline-flex items-center gap-1.5 rounded-xl sm:ml-auto"
        >
          <Icon name="logout" className="h-3.5 w-3.5" />
          <span>Putuskan Koneksi</span>
        </button>
      </div>

      {syncResult && (
        <div className={`px-4 py-3 rounded-xl text-xs ${
          syncResult.success ? 'bg-success-soft text-success-ink border border-success/30' : 'bg-danger-soft text-danger-ink border border-danger/30'
        }`}>
          {syncResult.success 
            ? `Berhasil! ${syncResult.courses} kelas ditemukan${syncResult.skipped ? `, ${syncResult.skipped} dilewati (siswa tidak terdaftar)` : ''}.`
            : syncResult.message
          }
        </div>
      )}

      {syncStudentsResult && (
        <div className="bg-success-soft text-success-ink border border-success/30 px-4 py-3 rounded-xl text-xs">
          {syncStudentsResult.message}
          {syncStudentsResult.details?.length > 0 && (
            <div className="mt-2 text-xs max-h-40 overflow-y-auto space-y-1">
              {syncStudentsResult.details.map((d, i) => (
                <div key={i}>{d.nama} ({d.nisn}) → {d.classroomId}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )}
</div>
  );
}
