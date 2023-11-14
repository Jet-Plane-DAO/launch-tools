const fetchCheck = async (
  stakeKey: string,
  includeItems?: boolean,
  campaignKey?: string,
) => {
  const requestHeaders: HeadersInit = new Headers();
  requestHeaders.set(
    'jetplane-api-key',
    process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
  );
  const result = await fetch(
    `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${
      campaignKey || process.env.NEXT_PUBLIC_VELOCITY_MINTING_CAMPAIGN_NAME
    }/check/${stakeKey}${
      includeItems
        ? `?${new URLSearchParams({
            includeItems: 'true',
          }).toString()}`
        : ''
    }`,
    { headers: requestHeaders },
  );

  const data = await result.json();
  return {
    status: data?.status || { crafts: [], mints: [], locked: [] },
    config: data.config,
  };
};

const fetchQuote = async (
  planId: string,
  inputUnits: string[],
  concurrent: number = 1,
  campaignType: string,
  availableBP?: any,
  campaignKey?: string,
) => {
  const requestHeaders: HeadersInit = new Headers();
  requestHeaders.set(
    'jetplane-api-key',
    process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
  );
  if (availableBP) {
    inputUnits.push(availableBP.unit);
  }
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${
      campaignKey || process.env.NEXT_PUBLIC_VELOCITY_MINTING_CAMPAIGN_NAME
    }/quote`,
    {
      headers: requestHeaders,
      method: 'post',
      body: JSON.stringify({
        inputUnits,
        planId,
        type: campaignType,
        concurrent,
      }),
    },
  );
  const data = await res.json();
  if (res.status === 422) {
    return { status: 'error', message: data.message };
  }
  if (res.status === 200) {
    return { status: 'OK', quote: data };
  }
  return { status: 'error', message: 'Unknown error' };
};