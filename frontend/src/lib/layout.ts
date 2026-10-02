import type { CodeAnalysis } from "../types/analysis";

export interface GraphItem {
  id: string;
  typeId: string;
  isMember: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphLayout {
  items: GraphItem[];
  width: number;
  height: number;
}

const COLUMNS = 3;
const COLUMN_WIDTH = 248;

const TYPE_WIDTH = 204;
const TYPE_HEIGHT = 70;

const MEMBER_WIDTH = 176;
const MEMBER_HEIGHT = 40;
const MEMBER_INDENT = 28;

const MEMBER_GAP = 8;
const TYPE_GAP = 30;
const GAP_Y = 38;

/** Types in a fixed grid; an expanded type stacks its members beneath it. */
export function layoutGraph(
  analysis: CodeAnalysis,
  expandedTypeId: string | null,
): GraphLayout {
  const items: GraphItem[] = [];
  const columnY = new Array<number>(COLUMNS).fill(0);

  analysis.types.forEach((type, index) => {
    const column = index % COLUMNS;
    const x = column * COLUMN_WIDTH;
    let y = columnY[column];

    items.push({
      id: type.id,
      typeId: type.id,
      isMember: false,
      x,
      y,
      width: TYPE_WIDTH,
      height: TYPE_HEIGHT,
    });

    y += TYPE_HEIGHT + TYPE_GAP;

    if (type.id === expandedTypeId) {
      for (const member of type.members) {
        items.push({
          id: member.id,
          typeId: type.id,
          isMember: true,
          x: x + MEMBER_INDENT,
          y,
          width: MEMBER_WIDTH,
          height: MEMBER_HEIGHT,
        });

        y += MEMBER_HEIGHT + MEMBER_GAP;
      }
    }

    columnY[column] = y + GAP_Y;
  });

  return {
    items,
    width: COLUMNS * COLUMN_WIDTH,
    height: columnY.length > 0 ? Math.max(...columnY) : 0,
  };
}
