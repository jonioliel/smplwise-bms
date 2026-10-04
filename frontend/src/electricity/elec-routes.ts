/**
 * CR-023 electricity (accounts, bills, customers, billing settings): every route this half of the UI uses, in ONE place. The shell
 * (pilot/elec-ui-meters, docs/architecture/ELECTRICITY_UI_SHELL.md) owns the area "תשתיות" and the sub-tab "מוני חשמל"; if a route
 * moves, only ELEC_ROOT / SETTINGS_ROOT here change.
 */
import { navigate } from '../router';

export const ELEC_ROOT = '/infra/electricity';
export const SETTINGS_ROOT = '/system/infra';

const p = (path: string): string => `#${path}`;
export const route = {
  accounts: () => `${ELEC_ROOT}/accounts`,
  accountNew: () => `${ELEC_ROOT}/accounts/new`,
  account: (id: string, tab: '' | 'history' | 'bills' | 'edit' = '') => `${ELEC_ROOT}/accounts/${id}${tab ? `/${tab}` : ''}`,
  bills: () => `${ELEC_ROOT}/bills`,
  bill: (id: string) => `${ELEC_ROOT}/bills/${id}`,
  customers: () => `${ELEC_ROOT}/customers`,
  customer: (id: string) => `${ELEC_ROOT}/customers/${id}`,
  settings: (section: 'prices' | 'business' | 'retention') => `${SETTINGS_ROOT}/${section}`,
};
/** hash links for <a href> */
export const href = {
  accounts: () => p(route.accounts()),
  accountNew: () => p(route.accountNew()),
  account: (id: string, tab: '' | 'history' | 'bills' | 'edit' = '') => p(route.account(id, tab)),
  bills: () => p(route.bills()),
  bill: (id: string) => p(route.bill(id)),
  customers: () => p(route.customers()),
  customer: (id: string) => p(route.customer(id)),
  settings: (section: 'prices' | 'business' | 'retention') => p(route.settings(section)),
};
export const go = (path: string): void => navigate(path);
