import { useMemo, useState } from 'react';
import { Plus, Pencil, TrendingUp, MessageSquare, ThumbsUp, Users, Loader2, UserPlus, ExternalLink } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ttc/StatusBadge';
import KpiCard from '@/components/ttc/KpiCard';
import { SESSIONS, downloadCsv, fmtDate, fmtMoney, toInputDateTime } from '@/lib/ttc';
import { logAudit } from '@/lib/automations';
import { cn } from '@/lib/utils';
import SchemaNotice from '@/components/ttc/SchemaNotice';

const EMPTY_POST = {
  title: '',
  url: '',
  publish_date: '',
  session: 'Asian Session',
  description: '',
  product: '',
  status: 'published',
  boosts: 0,
  comments: 0,
  replies: 0,
  leads_generated: 0,
  conversions: 0,
  revenue: 0,
  notes: '',
};

const EMPTY_INTERACTION = { username: '', comment: '', post_id: '', post_url: '', reply_status: 'pending', contact_status: 'pending', whatsapp_status: 'not_contacted' };

export default function TradingViewMarketing() {
  const { items: posts, loading, reload } = useRecords('TTCTradingViewPost', '-publish_date');
  const { items: interactions, reload: reloadInteractions } = useRecords('TTCTradingViewInteraction');
  const { items: products } = useRecords('TTCProduct');
  const [tab, setTab] = useState('posts');
  const [session, setSession] = useState('all');
  const [postDialog, setPostDialog] = useState({ open: false, post: null });
  const [postForm, setPostForm] = useState(EMPTY_POST);
  const [interactionForm, setInteractionForm] = useState(EMPTY_INTERACTION);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const visible = posts.filter((p) => session === 'all' || p.session === session);

  const stats = useMemo(() => {
    const totals = posts.reduce(
      (acc, p) => ({
        boosts: acc.boosts + Number(p.boosts || 0),
        comments: acc.comments + Number(p.comments || 0),
        replies: acc.replies + Number(p.replies || 0),
        leads: acc.leads + Number(p.leads_generated || 0),
        conversions: acc.conversions + Number(p.conversions || 0),
        revenue: acc.revenue + Number(p.revenue || 0),
      }),
      { boosts: 0, comments: 0, replies: 0, leads: 0, conversions: 0, revenue: 0 }
    );
    return {
      ...totals,
      published: posts.filter((p) => p.status === 'published' || p.status === 'boosted').length,
      leadsPerPost: posts.length ? (totals.leads / posts.length).toFixed(1) : '0',
      conversionRate: totals.leads ? Math.round((totals.conversions / totals.leads) * 100) : 0,
    };
  }, [posts]);

  const openPost = (post) => {
    setPostForm(post ? { ...EMPTY_POST, ...post, publish_date: toInputDateTime(post.publish_date) } : { ...EMPTY_POST, publish_date: toInputDateTime(new Date()) });
    setPostDialog({ open: true, post });
  };

  const savePost = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...postForm,
        publish_date: postForm.publish_date ? new Date(postForm.publish_date).toISOString() : new Date().toISOString(),
        boosts: Number(postForm.boosts || 0),
        comments: Number(postForm.comments || 0),
        replies: Number(postForm.replies || 0),
        leads_generated: Number(postForm.leads_generated || 0),
        conversions: Number(postForm.conversions || 0),
        revenue: Number(postForm.revenue || 0),
      };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by_id;
      if (postDialog.post) await ttcDataClient.entities.TTCTradingViewPost.update(postDialog.post.id, payload);
      else await ttcDataClient.entities.TTCTradingViewPost.create(payload);
      setPostDialog({ open: false, post: null });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const saveInteraction = async (e) => {
    e.preventDefault();
    if (!interactionForm.username.trim()) return;
    setSaving(true);
    try {
      await ttcDataClient.entities.TTCTradingViewInteraction.create({ ...interactionForm, recorded_by: 'Team' });
      setInteractionForm(EMPTY_INTERACTION);
      setInteractionOpen(false);
      reloadInteractions();
    } finally {
      setSaving(false);
    }
  };

  const createLeadFromInteraction = async (row) => {
    const lead = await ttcDataClient.entities.TTCLead.create({
      name: row.username,
      tradingview_username: row.username,
      lead_source: 'TradingView',
      post_url: row.post_url || '',
      status: 'new',
      notes: `From TradingView comment: ${row.comment || ''}`,
      stage_history: [{ stage: 'new', at: new Date().toISOString(), by: 'Team' }],
    });
    await ttcDataClient.entities.TTCTradingViewInteraction.update(row.id, { converted: true, lead_id: lead.id, contact_status: 'contacted' });
    if (row.post_id) {
      const post = posts.find((p) => p.id === row.post_id);
      if (post) await ttcDataClient.entities.TTCTradingViewPost.update(post.id, { leads_generated: Number(post.leads_generated || 0) + 1 });
    }
    await logAudit('lead_from_tradingview', 'TTCLead', lead.id, `Lead created from TradingView comment by @${row.username}`);
    reloadInteractions();
    reload();
    setTab('posts');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Organic acquisition</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">TradingView Marketing</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Three posts a day — Asian, European and US sessions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border bg-card p-1">
            {['posts', 'interactions'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn('rounded-lg px-3 py-1.5 text-[12px] capitalize transition-colors', tab === t ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === 'posts' ? (
            <Button size="sm" disabled title="TradingView marketing schema is not configured yet"><Plus className="mr-1.5 h-3.5 w-3.5" /> New post</Button>
          ) : (
            <Button size="sm" disabled title="TradingView interaction schema is not configured yet"><Plus className="mr-1.5 h-3.5 w-3.5" /> Log interaction</Button>
          )}
        </div>
      </header>

      <SchemaNotice title="TradingView post tracking is not connected">
        The current database does not yet contain post, boost, comment or interaction records. No sample marketing metrics are displayed. Manual post and comment tracking can be enabled after the dedicated tables and permissions are added.
      </SchemaNotice>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Posts published" value={stats.published} sub={`${posts.length} planned in total`} icon={TrendingUp} />
        <KpiCard label="Leads generated" value={stats.leads} sub={`${stats.leadsPerPost} per post`} icon={Users} tone="sky" />
        <KpiCard label="Engagement" value={stats.boosts + stats.comments + stats.replies} sub={`${stats.boosts} boosts · ${stats.comments} comments`} icon={ThumbsUp} tone="amber" />
        <KpiCard label="Attributed revenue" value={fmtMoney(stats.revenue)} sub={`${stats.conversionRate}% conversion`} icon={MessageSquare} />
      </div>

      {tab === 'posts' ? (
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <select value={session} onChange={(e) => setSession(e.target.value)} className="h-8 rounded-lg border bg-background px-2 text-[12px]">
              <option value="all">All sessions</option>
              {SESSIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-8 text-[11.5px]"
              onClick={() =>
                downloadCsv('ttc-tradingview-posts.csv', visible.map((p) => ({
                  title: p.title, session: p.session, date: fmtDate(p.publish_date), status: p.status,
                  boosts: p.boosts, comments: p.comments, replies: p.replies, leads: p.leads_generated,
                  conversions: p.conversions, revenue: p.revenue, url: p.url,
                })))
              }
            >
              Export CSV
            </Button>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Post</th>
                    <th className="px-3 py-2.5 font-medium">Session</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Boosts</th>
                    <th className="px-3 py-2.5 text-right font-medium">Comments</th>
                    <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                    <th className="px-3 py-2.5 text-right font-medium">Conv.</th>
                    <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                    <th className="px-4 py-2.5 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visible.map((p) => (
                    <tr key={p.id} className="group transition-colors hover:bg-muted/40">
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="truncate text-[13px] font-medium">{p.title}</p>
                        <p className="truncate text-[10.5px] text-muted-foreground">{p.product || '—'}</p>
                      </td>
                      <td className="px-3 py-3 text-[11.5px] text-muted-foreground">{p.session}</td>
                      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{fmtDate(p.publish_date)}</td>
                      <td className="px-3 py-3"><StatusBadge label={p.status} /></td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] tnum">{p.boosts || 0}</td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] tnum">{p.comments || 0}</td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] tnum">{p.leads_generated || 0}</td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] tnum">{p.conversions || 0}</td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] tnum">{fmtMoney(p.revenue)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {p.url && (
                            <a href={p.url} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></a>
                          )}
                          <button type="button" onClick={() => openPost(p)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="border-b p-3">
            <p className="text-[12px] text-muted-foreground">
              Record comments and replies from TradingView, then convert the promising ones into leads. No automatic TradingView access is assumed.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Username</th>
                  <th className="px-3 py-2.5 font-medium">Comment</th>
                  <th className="px-3 py-2.5 font-medium">Reply</th>
                  <th className="px-3 py-2.5 font-medium">WhatsApp</th>
                  <th className="px-3 py-2.5 font-medium">Converted</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {interactions.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-[12px]">@{row.username}</td>
                    <td className="max-w-[320px] px-3 py-3"><p className="truncate text-[12px] text-muted-foreground">{row.comment || '—'}</p></td>
                    <td className="px-3 py-3"><StatusBadge label={row.reply_status} /></td>
                    <td className="px-3 py-3"><StatusBadge label={row.whatsapp_status} /></td>
                    <td className="px-3 py-3">{row.converted ? <StatusBadge label="converted" /> : <span className="text-[11.5px] text-muted-foreground">No</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {!row.converted && (
                        <Button size="sm" variant="outline" disabled className="h-7 px-2 text-[11px]" onClick={() => createLeadFromInteraction(row)}>
                          <UserPlus className="mr-1 h-3 w-3" /> Create lead
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {interactions.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-14 text-center text-[12px] text-muted-foreground">No interactions logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={postDialog.open} onOpenChange={(v) => setPostDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{postDialog.post ? 'Edit post' : 'New TradingView post'}</DialogTitle></DialogHeader>
          <form onSubmit={savePost} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="mb-1 block text-[11px] text-muted-foreground">Post title *</Label>
                <Input required value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="mb-1 block text-[11px] text-muted-foreground">TradingView URL</Label>
                <Input value={postForm.url} onChange={(e) => setPostForm({ ...postForm, url: e.target.value })} placeholder="https://tradingview.com/chart/…" />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Publication date</Label>
                <Input type="datetime-local" value={postForm.publish_date} onChange={(e) => setPostForm({ ...postForm, publish_date: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Session</Label>
                <select value={postForm.session} onChange={(e) => setPostForm({ ...postForm, session: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  {SESSIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Product promoted</Label>
                <select value={postForm.product} onChange={(e) => setPostForm({ ...postForm, product: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  <option value="">None</option>
                  {products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Status</Label>
                <select value={postForm.status} onChange={(e) => setPostForm({ ...postForm, status: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  {['planned', 'published', 'boosted'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {[['boosts', 'Boosts'], ['comments', 'Comments'], ['replies', 'Replies'], ['leads_generated', 'Leads generated'], ['conversions', 'Conversions'], ['revenue', 'Attributed revenue']].map(([key, label]) => (
                <div key={key}>
                  <Label className="mb-1 block text-[11px] text-muted-foreground">{label}</Label>
                  <Input type="number" min="0" value={postForm[key]} onChange={(e) => setPostForm({ ...postForm, [key]: e.target.value })} />
                </div>
              ))}
              <div className="col-span-2">
                <Label className="mb-1 block text-[11px] text-muted-foreground">Description / notes</Label>
                <Textarea rows={2} value={postForm.description} onChange={(e) => setPostForm({ ...postForm, description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => setPostDialog({ open: false, post: null })}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save post'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={interactionOpen} onOpenChange={setInteractionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log a TradingView interaction</DialogTitle></DialogHeader>
          <form onSubmit={saveInteraction} className="space-y-3">
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">TradingView username *</Label>
              <Input required value={interactionForm.username} onChange={(e) => setInteractionForm({ ...interactionForm, username: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Comment</Label>
              <Textarea rows={2} value={interactionForm.comment} onChange={(e) => setInteractionForm({ ...interactionForm, comment: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Related post</Label>
                <select value={interactionForm.post_id} onChange={(e) => {
                  const post = posts.find((p) => p.id === e.target.value);
                  setInteractionForm({ ...interactionForm, post_id: e.target.value, post_url: post?.url || '' });
                }} className="h-9 w-full rounded-lg border bg-background px-2 text-[12.5px]">
                  <option value="">None</option>
                  {posts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Reply status</Label>
                <select value={interactionForm.reply_status} onChange={(e) => setInteractionForm({ ...interactionForm, reply_status: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[12.5px]">
                  {['pending', 'replied', 'ignored'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">WhatsApp status</Label>
                <select value={interactionForm.whatsapp_status} onChange={(e) => setInteractionForm({ ...interactionForm, whatsapp_status: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[12.5px]">
                  {['not_contacted', 'contacted', 'responded'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Contact status</Label>
                <select value={interactionForm.contact_status} onChange={(e) => setInteractionForm({ ...interactionForm, contact_status: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[12.5px]">
                  {['pending', 'contacted', 'no_response'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => setInteractionOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Save interaction</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}