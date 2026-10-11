import { useStaff } from './staffStore';

export default function MessagesMenu() {
  const { KELAS_LIST, deleteMessage, handleSendMessage, messageForm, messageSuccess, messages, setMessageForm } = useStaff();
  return (
<div className="space-y-4">
  {messageSuccess && (
    <div className="bg-success-soft text-success-ink px-4 py-3 rounded-xl text-sm">{messageSuccess}</div>
  )}

  <form onSubmit={handleSendMessage} className="card card-pad space-y-3">
    <h3 className="font-semibold text-ink">Kirim Pesan Baru</h3>
    <input
      type="text"
      placeholder="Judul pesan"
      value={messageForm.title}
      onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
      className="input w-full"
      required
    />
    <textarea
      placeholder="Isi pesan..."
      value={messageForm.content}
      onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
      className="input w-full h-24 resize-none"
      required
    />
    <div className="flex items-center gap-4">
      <label className="text-sm text-muted">Prioritas:</label>
      <select
        value={messageForm.priority}
        onChange={(e) => setMessageForm({ ...messageForm, priority: e.target.value })}
        className="input"
      >
        <option value="low">Rendah</option>
        <option value="normal">Normal</option>
        <option value="high">Tinggi</option>
        <option value="urgent">Mendesak</option>
      </select>
    </div>
    <label className="flex items-center gap-2 text-sm text-muted">
      <input
        type="checkbox"
        checked={messageForm.isGlobal}
        onChange={(e) => setMessageForm({ ...messageForm, isGlobal: e.target.checked })}
        className="rounded"
      />
      Kirim ke semua siswa
    </label>
    {!messageForm.isGlobal && (
      <div className="flex flex-wrap gap-1">
        {KELAS_LIST.map(k => (
          <label key={k} className="chip text-xs">
            <input
              type="checkbox"
              checked={messageForm.targetKelas.includes(k)}
              onChange={(e) => {
                const kelas = e.target.checked
                  ? [...messageForm.targetKelas, k]
                  : messageForm.targetKelas.filter(x => x !== k);
                setMessageForm({ ...messageForm, targetKelas: kelas });
              }}
            />
            {k}
          </label>
        ))}
      </div>
    )}
    <button type="submit" className="btn-primary w-full py-2.5">
      Kirim Pesan
    </button>
  </form>

  <div className="space-y-2">
    <h3 className="text-sm font-semibold text-muted uppercase">Riwayat Pesan</h3>
    {messages.map(msg => (
      <div key={msg._id} className="row-card">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-sm text-ink">{msg.title}</h4>
            <p className="text-xs text-muted mt-1">{msg.content}</p>
            <p className="text-xs text-muted mt-1">
              {new Date(msg.createdAt).toLocaleDateString('id-ID')} - {msg.isGlobal ? 'Global' : msg.targetKelas?.join(', ')}
            </p>
          </div>
          <button onClick={() => deleteMessage(msg._id)} className="text-danger hover:text-danger text-xs">Hapus</button>
        </div>
      </div>
    ))}
  </div>
</div>
  );
}
