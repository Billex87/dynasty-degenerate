export function HeaderCssLights() {
  const lights = [
    ['7%', '38%', '38px', '#00C8E8', '6px', '0s', '5.2s', '.38'],
    ['14%', '54%', '18px', '#E85A10', '4px', '.7s', '4.8s', '.35'],
    ['21%', '42%', '10px', '#F4A020', '3px', '1.8s', '5.8s', '.42'],
    ['48%', '50%', '12px', '#00C8E8', '4px', '1.1s', '6.5s', '.25'],
    ['72%', '45%', '14px', '#00C8E8', '5px', '2.3s', '5.9s', '.30'],
    ['89%', '34%', '32px', '#E85A10', '7px', '.4s', '4.6s', '.40'],
    ['96%', '27%', '16px', '#F4A020', '4px', '1.4s', '6.1s', '.42'],
  ];

  return (
    <div className="dd-header-css-lights" aria-hidden="true">
      {lights.map(([x, y, size, color, blur, delay, duration, peak], index) => (
        <span
          key={index}
          style={
            {
              '--x': x,
              '--y': y,
              '--size': size,
              '--color': color,
              '--blur': blur,
              '--delay': delay,
              '--duration': duration,
              '--peak': peak,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}