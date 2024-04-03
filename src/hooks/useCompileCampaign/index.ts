import { useCallback, useState } from 'react';
import { Transaction } from '@meshsdk/core';
import { useWallet } from '@meshsdk/react';
import { useCampaignAssets } from '../useCampaignAssets';
import PropTypes from 'prop-types';
import {
  getNativeTokenAsset,
  logConfig,
  noAssetsAdaAmount,
  sendAssets,
  setAddressMetadata,
  submitTx,
  validatePlan,
} from '../../helpers/tx';
import { fetchCheck, fetchQuote } from '../../helpers/quote';

type IUseCompileCampaign = {
  check: (includeItems?: boolean) => void;
  compile: (planId: string, input: any[], concurrent: number) => void;
  quote: (planId: string, inputUnits: string[], concurrent: number) => Promise<any>;
  campaignConfig: any;
  craftingData: any;
  availableBP: any;
  status: CompileStatusEnum;
};

export enum CompileStatusEnum {
  INIT = 'INIT',
  CHECKING = 'CHECKING',
  READY = 'READY',
  CRAFTING = 'CRAFTING',
  CRAFTING_PENDING = 'CRAFTING_PENDING',
  CLAIMING = 'CLAIMING',
  CLAIM_PENDING = 'CLAIM_PENDING',
  UPGRADING = 'UPGRADING',
  UPGRADE_PENDING = 'UPGRADE_PENDING',
}

/**
 * Velocity Tools Crafting Campaign Hook
 *
 *
 * @return   {Object}
 *           object with config, data and methods
 *
 * @property {Object} campaignConfig
 *           The configuration and metadata for the campaign
 *
 * @property {Object} craftingData
 *           The current crafting data for selected wallet, inlcuding locked assets, crafts and mints.
 *
 * @property {()=>void} check
 *           Check the status of the campaign and update the crafting data for the currently connected wallet
 *
 * @property {(planId: string, inputUnits: string[], concurrent: number)=>void} quote
 *           Fetches a quote for a craft transaction, returns the quote data, this includes the quantity, fee, token price, time to craft and any effective modifiers that are being applied.
 *
 * @property {(planId: string, input: any[], concurrent: number)=>void} craft
 *           Create a craft transaction to begin crafting an item, optionally if the plan has 0 time it will be claimed immediately, the claim fee must be included.
 *
 * @property {(craftId: string)=>void} claim
 *           Create a claim transaction for an existing craft
 *
 * @example
 *   const ExampleComponent = () => {
       const { check, craft, claim, campaignConfig, status, craftingData } = useCraftingCampaign();
 *
       useEffect(() => {
  *       check();
  *    }, []);
  *
 *     return (
 *       <>
 *
 *         <button onClick={() => craft('plan-1', []}>Craft items</button>
 *         <button onClick={() => quote('plan-1, [])}>Reset counter</button>
 *         <button onClick={decrement}>Decrement counter</button>
 *         <p>{count}</p>
 *       </>
 *      )
 *    }
 */

export const useCompileCampaign = (
  campaignKey?: string,
  tag?: string,
): IUseCompileCampaign => {
  const { craftingData, setCraftingData, availableBP } = useCampaignAssets();
  const [status, setStatus] = useState<CompileStatusEnum>(CompileStatusEnum.INIT);
  const [campaignConfig, setConfigData] = useState<any | null>(null);
  const { wallet, connected } = useWallet();

  const check = async (includeItems?: boolean) => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }
    if (!wallet) return;
    setStatus(CompileStatusEnum.CHECKING);
    const addresses = await wallet.getRewardAddresses();
    const stakeKey = addresses[0];
    const quote = await fetchCheck(stakeKey, includeItems, campaignKey, tag);
    setCraftingData(quote?.status || { mints: [] });
    setConfigData(quote.config);
    setStatus(CompileStatusEnum.READY);
    return;
  };

  const quote = async (
    planId: string,
    inputUnits: string[],
    concurrent: number = 1,
    tokenSplit: number = 0,
  ) => {
    return await fetchQuote(
      planId,
      inputUnits,
      concurrent,
      'compile',
      availableBP,
      campaignKey,
      tokenSplit,
    );
  };

  const compile = useCallback(
    async (
      planId: string,
      selectedInputs: any[],
      concurrent: number = 1,
      tokenSplit: number = 0,
    ) => {
      logConfig({
        campaignConfig,
        craftingData,
        availableBP,
        connected,
        status,
      });

      const plan = validatePlan(connected, campaignConfig, planId, selectedInputs);
      const quoteResponse = await quote(
        planId,
        selectedInputs.map((i) => i.unit),
        concurrent,
        tokenSplit,
      );
      if (!quoteResponse?.quote) throw new Error('Quote not found');

      const tx = new Transaction({ initiator: wallet });

      const nativeTokenAsset = getNativeTokenAsset(campaignConfig, plan);

      await sendAssets(
        quoteResponse.quote.time === 0
          ? quoteResponse.quote.fee
          : noAssetsAdaAmount(quoteResponse.quote),
        quoteResponse.quote.price,
        (quoteResponse.quote.assetsToInclude || []).map((x: any) => x.asset),
        tx,
        wallet,
        campaignConfig.walletAddress,
        nativeTokenAsset,
      );

      tx.setMetadata(0, {
        t: 'compile',
        p: planId,
        c: concurrent,
        s: `${tokenSplit}`,
      });

      let ix = 1;
      selectedInputs.forEach((i) => {
        ix = setAddressMetadata(tx, ix, i.unit);
      });
      if (availableBP) {
        ix = setAddressMetadata(tx, ix, availableBP.unit);
      }

      const hash = await submitTx(tx, wallet);

      return hash;
    },
    [availableBP, connected, wallet, status, campaignConfig],
  );

  return {
    check,
    compile,
    campaignConfig,
    status,
    craftingData,
    availableBP,
    quote,
  };
};

useCompileCampaign.PropTypes = {
  campaignKey: PropTypes.string,
};

useCompileCampaign.defaultProps = {};
