// One screen: top bar + content column.
import TopBar from './TopBar.jsx';

export default function Screen({ title, back = false, actions = null, children }) {
  return (
    <>
      <TopBar title={title} back={back} actions={actions} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-safe py-6">{children}</main>
    </>
  );
}
