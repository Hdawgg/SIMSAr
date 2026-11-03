import { initialsOf } from '../utils/format';

export default function Avatar({ name, size = 48 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {initialsOf(name)}
    </div>
  );
}
