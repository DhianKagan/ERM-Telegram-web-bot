/* eslint-env jest */

export const clearAccessToken = jest.fn();
export const getAccessToken = jest.fn(() => null);
export const setAccessToken = jest.fn();
export const shouldUseBearerAuth = jest.fn(() => false);

export default {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  shouldUseBearerAuth,
};
