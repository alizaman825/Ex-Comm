const axios = require('axios');
const { config } = require('../src/config/env');
const { unlockHtml, collectDataset } = require('../src/scrapers/brightdata');

afterEach(() => {
  jest.restoreAllMocks();
  config.brightdata.apiKey = '';
  config.brightdata.zone = '';
});

describe('unlockHtml', () => {
  it('posts to the Web Unlocker REST API with the configured zone and returns raw HTML', async () => {
    config.brightdata.apiKey = 'key';
    config.brightdata.zone = 'zone1';
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: '<html>ok</html>' });
    const html = await unlockHtml('https://example.com/page');
    expect(html).toBe('<html>ok</html>');
    expect(post).toHaveBeenCalledWith(
      'https://api.brightdata.com/request',
      { zone: 'zone1', url: 'https://example.com/page', format: 'raw' },
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer key' }) })
    );
  });

  it('reports missing config without making a request', async () => {
    const post = jest.spyOn(axios, 'post');
    await expect(unlockHtml('https://example.com')).rejects.toMatchObject({ code: 'CONFIG' });
    expect(post).not.toHaveBeenCalled();

    config.brightdata.apiKey = 'key'; // zone still missing
    await expect(unlockHtml('https://example.com')).rejects.toMatchObject({ code: 'CONFIG' });
    expect(post).not.toHaveBeenCalled();
  });

  it('reports an auth rejection distinctly from a generic HTTP error', async () => {
    config.brightdata.apiKey = 'key';
    config.brightdata.zone = 'zone1';
    jest.spyOn(axios, 'post').mockResolvedValue({ status: 401, data: 'unauthorized' });
    await expect(unlockHtml('https://example.com')).rejects.toMatchObject({ code: 'AUTH', status: 401 });
  });
});

describe('collectDataset', () => {
  beforeEach(() => {
    config.brightdata.apiKey = 'key';
  });

  it('triggers a job, polls until ready, and returns the snapshot records', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { snapshot_id: 'snap-1' } });
    const get = jest
      .spyOn(axios, 'get')
      .mockResolvedValueOnce({ status: 200, data: { status: 'running' } })
      .mockResolvedValueOnce({ status: 200, data: { status: 'ready' } })
      .mockResolvedValueOnce({ status: 200, data: [{ title: 'x' }] });

    const records = await collectDataset('ds-1', { keyword: 'phone' }, { pollIntervalMs: 1 });
    expect(records).toEqual([{ title: 'x' }]);
    expect(post).toHaveBeenCalledWith(
      'https://api.brightdata.com/datasets/v3/trigger',
      [{ keyword: 'phone' }],
      expect.objectContaining({ params: { dataset_id: 'ds-1' } })
    );
    expect(get).toHaveBeenCalledTimes(3); // progress x2, snapshot x1
  });

  it('times out if the job never becomes ready', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { snapshot_id: 'snap-1' } });
    jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: { status: 'running' } });
    await expect(collectDataset('ds-1', { keyword: 'phone' }, { pollTimeoutMs: 20, pollIntervalMs: 5 })).rejects.toMatchObject({ code: 'BUDGET' });
  });

  it('reports a failed collection', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { snapshot_id: 'snap-1' } });
    jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: { status: 'failed' } });
    await expect(collectDataset('ds-1', { keyword: 'phone' }, { pollIntervalMs: 1 })).rejects.toMatchObject({ code: 'HTTP' });
  });
});
