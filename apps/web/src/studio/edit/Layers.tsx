import { Button, Checkbox, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowDownRegular, ArrowUpRegular, DismissRegular } from "@fluentui/react-icons";
import type { Scene, SceneElement } from "../../contracts";
import { isBackground } from "../background";
import { lower, raise } from "../geometry";
import { WIDGET_BY_TYPE } from "./ElementLibrary";

const useStyles = makeStyles({
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalXS },
  pick: { flexGrow: 1, justifyContent: "flex-start", minWidth: 0 },
});

interface LayersProps {
  scene: Scene;
  selectedId: string | null;
  onSelect(elementId: string | null): void;
  onChange(elements: SceneElement[]): void;
}

/** The scene's elements, top layer first: show or hide, select, restack and remove each. */
export function Layers({ scene, selectedId, onSelect, onChange }: LayersProps) {
  const styles = useStyles();
  const stacked = [...scene.elements].sort((a, b) => b.layer - a.layer);
  const patch = (id: string, changes: Partial<SceneElement>) =>
    onChange(scene.elements.map((element) => (element.id === id ? { ...element, ...changes } : element)));

  return (
    <ul className={styles.list}>
      {stacked.map((element) => {
        const name = isBackground(element) ? "background" : element.type;
        return (
        <li key={element.id} className={styles.row}>
          <Checkbox aria-label={`Show ${name}`} checked={element.visible} onChange={(_, data) => patch(element.id, { visible: data.checked === true })} />
          <Button className={styles.pick} size="small" appearance={element.id === selectedId ? "primary" : "subtle"}
            aria-label={`Select ${name}`} onClick={() => onSelect(element.id)}>
            {isBackground(element) ? "Background" : (WIDGET_BY_TYPE.get(element.type)?.label ?? element.type)}
          </Button>
          <Button size="small" appearance="subtle" icon={<ArrowUpRegular />} aria-label={`Bring ${name} forward`} onClick={() => onChange(raise(scene.elements, element.id))} />
          <Button size="small" appearance="subtle" icon={<ArrowDownRegular />} aria-label={`Send ${name} back`} onClick={() => onChange(lower(scene.elements, element.id))} />
          <Button size="small" appearance="subtle" icon={<DismissRegular />} aria-label={`Remove ${name}`} onClick={() => onChange(scene.elements.filter((other) => other.id !== element.id))} />
        </li>
        );
      })}
    </ul>
  );
}
