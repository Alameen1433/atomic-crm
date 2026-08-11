const AUTO_SCROLL_EDGE_SIZE = 96;
const AUTO_SCROLL_MAX_SPEED = 20;

export const getHorizontalAutoScrollSpeed = (
  pointerX: number,
  containerLeft: number,
  containerRight: number,
) => {
  const edgeSize = Math.min(
    AUTO_SCROLL_EDGE_SIZE,
    (containerRight - containerLeft) * 0.2,
  );
  const leftDistance = pointerX - containerLeft;
  const rightDistance = containerRight - pointerX;

  if (leftDistance < edgeSize) {
    const intensity = Math.min(1, Math.max(0, 1 - leftDistance / edgeSize));
    return -Math.max(2, Math.round(AUTO_SCROLL_MAX_SPEED * intensity ** 2));
  }
  if (rightDistance < edgeSize) {
    const intensity = Math.min(1, Math.max(0, 1 - rightDistance / edgeSize));
    return Math.max(2, Math.round(AUTO_SCROLL_MAX_SPEED * intensity ** 2));
  }
  return 0;
};
