import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { useWallet } from '@meshsdk/react';
import { Transaction } from '@meshsdk/core';
import { LOVELACE_MULTIPLIER } from '../../helpers/ada';

type IUseStakingCampaign = {
  check: () => void;
  register: () => void;
  claim: () => void;
  campaignConfig: any;
  stakingData: any;
  status: StakingStatus;
};

enum StakingStatus {
  STAKED = 'STAKED',
  UNSTAKED = 'UNSTAKED',
  INIT = 'INIT',
  CHECKING = 'CHECKING',
  REGISTERING = 'REGISTERING',
  REGISTRATION_PENDING = 'REGISTRATION_PENDING',
  CLAIMING = 'CLAIMING',
  CLAIM_PENDING = 'CLAIM_PENDING',
}

/**
 * Classic counter example to help understand the flow of this npm package
 *
 *
 * @return   {Object}
 *           object with config, data and methods
 *
 * @property {number} campaignConfig
 *           The current count state
 *
 * @property {()=>void} claim
 *           the increment function
 *
 * @property {()=>void} register
 *           the decrement function
 *
 * @property {()=>void} check
 *           the reset function
 *
 * @example
 *   const ExampleComponent = () => {
 *     const { count, increment, reset, decrement } = useCounter();
 *
 *     return (
 *       <>
 *         <button onClick={increment}>Increment counter</button>
 *         <button onClick={reset}>Reset counter</button>
 *         <button onClick={decrement}>Decrement counter</button>
 *         <p>{count}</p>
 *       </>
 *      )
 *    }
 */

export const useStakingCampaign = (): IUseStakingCampaign => {
  const { connected, wallet } = useWallet();
  const [stakingData, setStakingData] = useState(null);
  const [status, setStatus] = useState<StakingStatus>(StakingStatus.INIT);
  const [campaignConfig, setConfigData] = useState<any | null>(null);

  const check = useCallback(() => {
    if (connected && status === StakingStatus.INIT) {
      setStatus(StakingStatus.CHECKING);
      wallet.getRewardAddresses().then((addresses) => {
        const stakeKey = addresses[0];
        const requestHeaders: HeadersInit = new Headers();
        requestHeaders.set(
          'jetplane-api-key',
          process.env.NEXT_PUBLIC_LAUNCH_API_KEY ?? '',
        );
        fetch(
          `${process.env.NEXT_PUBLIC_LAUNCH_API}/campaign/${process.env.NEXT_PUBLIC_LAUNCH_STAKING_CAMPAIGN_NAME}/check/${stakeKey}`,
          { headers: requestHeaders },
        ).then(async (res) => {
          if (res.status === 200) {
            const data = await res.json();
            setStakingData(data.status);
            setConfigData(data.config);
            setStatus(StakingStatus.STAKED);
          } else {
            setStatus(StakingStatus.UNSTAKED);
          }
          return;
        });
      });
    }
  }, []);

  const register = useCallback(async () => {
    if (status !== StakingStatus.UNSTAKED) return;
    setStatus(StakingStatus.REGISTERING);

    const tx = new Transaction({ initiator: wallet }).sendLovelace(
      campaignConfig!.walletAddress,
      `${campaignConfig!.registrationFee}`,
    );
    const unsignedTx = await tx.build();
    const signedTx = await wallet.signTx(unsignedTx);
    await wallet.submitTx(signedTx);
    setStatus(StakingStatus.REGISTRATION_PENDING);
    return;
  }, [status]);

  const claim = useCallback(async () => {
    if (status !== StakingStatus.STAKED) return;
    setStatus(StakingStatus.CLAIMING);
    const tx = new Transaction({ initiator: wallet }).sendLovelace(
      campaignConfig.walletAddress,
      `${campaignConfig.claimFee * LOVELACE_MULTIPLIER}`,
    );
    const unsignedTx = await tx.build();
    const signedTx = await wallet.signTx(unsignedTx);
    await wallet.submitTx(signedTx);

    setStatus(StakingStatus.CLAIM_PENDING);
    return;
  }, [status]);

  return { check, register, claim, campaignConfig, status, stakingData };
};

useStakingCampaign.PropTypes = {
  initialValue: PropTypes.number.isRequired,
};

useStakingCampaign.defaultProps = {
  initialValue: 0,
};