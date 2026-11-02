import { useEffect, useRef, useState } from 'react';
import { Handwriting, InkButton, InkCard, InkCheckbox, InkInput, InkIcon, shapes, useInkLayer, Write } from '@pen-ink/react';

interface Task { id: number; text: string; done: boolean }
const KEY = 'pen-ink-demo-notes';
const load = (): Task[] => { try { return JSON.parse(localStorage.getItem(KEY) || '') } catch { return [] } };
const SAMPLE: Task[] = [
  { id: 1, text: 'Refill the fountain pen', done: true },
  { id: 2, text: 'Sketch the bridge at dawn', done: false },
  { id: 3, text: 'Order cotton paper', done: false },
];

/** A handwritten task that gets struck through when done, and scratched out when deleted. */
function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [gone, setGone] = useState(false);
  const { svgRef, ink, isDrawn } = useInkLayer(textRef, {
    seedKey: 'task' + task.id,
    // Strike through after the text has had time to be written.
    draw: (i, { animate }) => (task.done ? i.paint('strike', shapes.strike(4, i.h * 0.36, i.w - 8, { seed: task.id }), { animate, speed: 900 }) : undefined),
  });
  useEffect(() => {
    const i = ink();
    if (!i || !isDrawn()) return;
    if (task.done) i.paint('strike', shapes.strike(4, i.h * 0.36, i.w - 8, { seed: task.id }), { speed: 900 });
    else i.erase('strike');
  }, [task.done]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = async () => {
    const i = ink();
    if (i) await i.paint('scratch', shapes.scratchOut(2, i.h * 0.2, i.w - 4, i.h * 0.55, { seed: task.id }), { speed: 1600, pen: { size: 2.6 } });
    setGone(true);
    setTimeout(onDelete, 350);
  };
  return (
    <li className={'task' + (task.done ? ' done' : '') + (gone ? ' gone' : '')}>
      <InkCheckbox checked={task.done} onChange={onToggle} aria-label={`Done: ${task.text}`} />
      <span ref={textRef} className="ink-host task-text">
        <svg ref={svgRef} className="ink-layer" aria-hidden="true" />
        <Handwriting hand="casual" size={30} wrap={false} seed={task.id % 997}>{task.text}</Handwriting>
      </span>
      <button className="del" aria-label={`Delete: ${task.text}`} onClick={remove}><InkIcon name="trash" size={20} /></button>
    </li>
  );
}

export function Notes() {
  const [tasks, setTasks] = useState<Task[]>(() => { const t = load(); return t.length ? t : SAMPLE; });
  const [draft, setDraft] = useState('');
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch {} }, [tasks]);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setTasks((t) => [...t, { id: Date.now() % 1e6, text: draft.trim(), done: false }]);
    setDraft(''); // the input's ink lifts off
  };
  return (
    <div className="notes">
      <section>
        <Write as="p" className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Write>
        <Handwriting as="h1" hand="casual" style={{ fontSize: 54 }}>Today's list</Handwriting>
        <ul className="tasks">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t}
              onToggle={() => setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
              onDelete={() => setTasks((all) => all.filter((x) => x.id !== t.id))} />
          ))}
        </ul>
        <form className="adder" onSubmit={add}>
          <InkInput label="New task" placeholder="Add a task and press Enter…" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} />
          <InkButton variant="solid" type="submit">Write it</InkButton>
        </form>
        <Write as="p" className="hint">Tick a task to strike it. The bin scratches it out. Your list is kept in this browser.</Write>
      </section>
      <aside>
        <InkCard className="card sticky" shadow="none">
          <Write as="p" className="label">Note to self</Write>
          <Handwriting hand="pepita" style={{ fontSize: 24 }}>Buy more iron gall ink. Try the cotton paper with the broad nib.</Handwriting>
        </InkCard>
      </aside>
    </div>
  );
}
