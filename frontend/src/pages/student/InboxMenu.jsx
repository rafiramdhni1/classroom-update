import { useState } from 'react';
import { useStudent } from './studentStore';
import { Card, Tabs, EmptyState, Banner, PageHeader } from '../../components/ui';
import Icon from '../../components/icons';

const PRIORITY = {
  urgent: { label: 'Mendesak', cls: 'bg-danger-soft text-danger-ink', ico: 'bell' },
  high: { label: 'Penting', cls: 'bg-warn-soft text-warn-ink', ico: 'bell' },
  normal: { label: 'Normal', cls: 'bg-accent-soft text-accent-ink', ico: 'messages' },
  low: { label: 'Rendah', cls: 'bg-surface2 text-muted', ico: 'messages' },
};

export default function InboxMenu() {
  const { data, unread, isRead, markAsRead } = useStudent();
  const [filter, setFilter] = useState('semua');
  const [openId, setOpenId] = useState(null);

  const all = data?.messages || [];
  const list = filter === 'baru' ? all.filter(m => !isRead(m)) : all;

  return (
    <div className="space-y-5 animate-fadeUp">
      <PageHeader
        eyebrow="Informasi sekolah"
        title="Kotak Pesan"
        subtitle="Pengumuman dan informasi dari admin sekolah."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { key: 'semua', label: `Semua (${all.length})` },
            { key: 'baru', label: `Belum dibaca (${unread})` },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {unread > 0 && (
          <span className="badge-accent px-3 py-1">
            <Icon name="bell" className="h-3.5 w-3.5" />
            {unread} baru
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={filter === 'baru' ? 'Semua pesan sudah dibaca' : 'Belum ada pesan'}
          desc="Pesan dari admin akan muncul di sini."
        />
      ) : (
        <div className="space-y-3">
          {list.map(msg => {
            const read = isRead(msg);
            const p = PRIORITY[msg.priority] || PRIORITY.normal;
            const isOpen = openId === msg._id;
            return (
              <Card key={msg._id} pad={false} className={read ? '' : 'border-accent/40'}>
                <button
                  onClick={() => {
                    setOpenId(isOpen ? null : msg._id);
                    if (!read) markAsRead(msg._id);
                  }}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${p.cls}`}>
                    <Icon name={p.ico} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 text-sm font-bold text-ink">{msg.title}</p>
                      {!read && <span className="badge-accent">Baru</span>}
                      <span className={`badge ${p.cls}`}>{p.label}</span>
                    </div>
                    {isOpen && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{msg.content}</p>
                    )}
                    <p className="mt-1.5 text-[11px] text-muted/80">
                      {new Date(msg.createdAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                    </p>
                  </div>
                  <Icon name="chevronDown" className={`mt-1 h-4 w-4 shrink-0 text-muted transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {!isOpen && msg.priority === 'urgent' && (
                  <div className="px-4 pb-4">
                    <Banner tone="danger">Pesan mendesak — segera dibaca sampai selesai.</Banner>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
