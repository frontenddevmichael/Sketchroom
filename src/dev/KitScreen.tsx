import { ArrowRight, Box, Layers, MousePointerClick, Users } from 'lucide-react';
import {
  Button,
  Field,
  Frame,
  IconTile,
  Kbd,
  Rule,
  Section,
  Sheet,
  Tag,
} from '../ui';
import { EmptyAi, EmptyHistory, EmptyRooms, HeroDraftingTable, SketchIn } from '../illustration';
import { useTheme } from '../lib/useTheme';
import './KitScreen.css';

/**
 * Dev-only kit: every primitive in every state, both themes. Reached at
 * /dev/kit while running `pnpm dev`. Not shipped: the route is added under
 * `import.meta.env.DEV` in App.tsx.
 */
export function KitScreen() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="kit">
      <Frame>
        <div className="kit-bar">
          <Tag accent>dev kit</Tag>
          <Button variant="ghost" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </Button>
        </div>
        <Rule />

        <Section
          eyebrow={<Tag>actions</Tag>}
          title="One action, four weights"
          lead="Primary is ink-filled and carries the arrow. Everything else is text or hairline; radius never exceeds 4px."
        >
          <div className="kit-row">
            <Button>Start sketching</Button>
            <Button variant="secondary">Watch a room</Button>
            <Button variant="ghost">Invite</Button>
            <Button variant="icon" aria-label="Pointer tool">
              <MousePointerClick size={20} />
            </Button>
          </div>
          <div className="kit-row">
            <Button disabled>Disabled</Button>
            <Button loading>Committing</Button>
            <Button variant="ghost" arrow>
              Restore
            </Button>
          </div>
        </Section>

        <Rule />

        <Section
          eyebrow={<Tag>annotation</Tag>}
          title="Tags and tiles"
          lead="Dotted mono tags annotate; tiles carry a glyph and a label."
        >
          <div className="kit-row">
            <Tag>3 cursors live</Tag>
            <Tag solid>v2.0</Tag>
            <Tag accent>
              <ArrowRight size={12} /> committed
            </Tag>
          </div>
          <div className="kit-row kit-row--tiles">
            <IconTile icon={<Users size={20} />} label="Live by default" description="Presence, cursors, who is here" />
            <IconTile icon={<Box size={20} />} label="AI that shows its work" description="Dashed proposals, no surprises" />
            <IconTile icon={<Layers size={20} />} label="Every change reversible" description="Snapshots you can restore" />
          </div>
        </Section>

        <Rule />

        <Section eyebrow={<Tag>surfaces</Tag>} title="Sheets and fields">
          <div className="kit-grid">
            <Sheet title="Room name" meta={<Tag solid>owner</Tag>}>
              <div className="kit-stack">
                <Field label="Name" placeholder="Auth flow review" hint="Shown to everyone in the room." />
                <Field label="Email" defaultValue="not-an-email" error="Enter a valid email address." />
                <Field label="Locked" defaultValue="read only" disabled />
              </div>
            </Sheet>
            <Sheet>
              <p className="kit-copy">
                Sheets are hairline-bordered surfaces on paper — never glass, never a
                shadow deeper than 2px. Panels in the product are built from this.
              </p>
              <div className="kit-row">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
                <span className="kit-copy">opens the copilot</span>
              </div>
            </Sheet>
          </div>
        </Section>

        <Rule />

        <Section
          eyebrow={<Tag>illustration</Tag>}
          title="The isometric kit"
          lead="True 30° projection in world units, one stroke weight, tokens for every fill. The dashed block is a proposal; committing it is the only state change."
        >
          <div className="kit-scenes">
            <div className="kit-scene kit-scene--wide">
              <HeroDraftingTable caption="3 cursors live" />
            </div>
            <div className="kit-scene kit-scene--wide">
              <HeroDraftingTable state="committed" caption="committed" />
            </div>
            <div className="kit-scene">
              <SketchIn caption="loading" />
            </div>
            <div className="kit-scene">
              <EmptyRooms caption="no rooms" />
            </div>
            <div className="kit-scene">
              <EmptyHistory caption="no snapshots" />
            </div>
            <div className="kit-scene">
              <EmptyAi caption="nothing proposed" />
            </div>
          </div>
        </Section>

        <Rule />
        <p className="kit-foot">
          Frame rules and dashed guides are part of the layout, not decoration.
        </p>
      </Frame>
    </div>
  );
}
