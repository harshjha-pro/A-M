// History of one record (/history/:resource/:id) or of the wedding details.
import { useParams } from 'react-router-dom';
import Screen from '../../components/Screen.jsx';
import HistoryList from '../../components/HistoryList.jsx';
import { t } from '../../i18n/strings.en.js';

export default function HistoryScreen() {
  const { resource, id } = useParams();
  const path = resource ? `/${resource}/${id}/history` : '/settings/history';
  const pages = { members: '/settings/members/', tasks: '/tasks/', events: '/calendar/events/', households: '/guests/',
    payments: '/money/payments/', vendors: '/vendors/', documents: '/documents/' };
  const back = !resource ? '/settings/wedding' : pages[resource] ? `${pages[resource]}${id}` : '/settings/safety';
  return (
    <Screen title={t('history.title')} back={back}>
      <HistoryList path={path} />
    </Screen>
  );
}
