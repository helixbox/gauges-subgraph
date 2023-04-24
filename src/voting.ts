import { VotingEscrowLock, VotingEscrow, LockSnapshot } from './types/schema';
import { Deposit, Supply, Withdraw } from './types/VotingEscrow/votingEscrow';
import { LOCK_MAXTIME, ZERO_BD } from './utils/constants';
import { getLockSnapshotId, getVotingEscrowId } from './utils/gauge';
import { scaleDownBPT, scaleUp } from './utils/maths';
import { createUserEntity } from './utils/misc';

export function handleDeposit(event: Deposit): void {
  let userAddress = event.params.provider;
  createUserEntity(userAddress);

  let id = getVotingEscrowId(userAddress, event.address);
  let votingShare = VotingEscrowLock.load(id);

  if (votingShare == null) {
    votingShare = new VotingEscrowLock(id);
    votingShare.user = userAddress.toHexString();
    votingShare.votingEscrowID = event.address.toHexString();
    votingShare.lockedBalance = ZERO_BD;
  }

  let blockTimestamp = event.block.timestamp;
  let depositAmount = scaleDownBPT(event.params.value);

  votingShare.unlockTime = event.params.locktime;
  votingShare.updatedAt = blockTimestamp.toI32();

  votingShare.lockedBalance = votingShare.lockedBalance.plus(depositAmount);

  const slopeBI = scaleUp(votingShare.lockedBalance, 18).div(LOCK_MAXTIME);
  const biasBI = slopeBI.times(votingShare.unlockTime.minus(blockTimestamp));
  votingShare.slope = scaleDownBPT(slopeBI);
  votingShare.bias = scaleDownBPT(biasBI);

  votingShare.save();

  const snapshotId = getLockSnapshotId(userAddress, blockTimestamp.toI32());
  let lockSnapshot = LockSnapshot.load(snapshotId);

  if (lockSnapshot == null) {
    lockSnapshot = new LockSnapshot(snapshotId);
    lockSnapshot.timestamp = votingShare.updatedAt;
    lockSnapshot.user = userAddress.toHexString();
    lockSnapshot.slope = votingShare.slope;
    lockSnapshot.bias = votingShare.bias;
  }

  lockSnapshot.save();
}

export function handleWithdraw(event: Withdraw): void {
  let userAddress = event.params.provider;
  createUserEntity(userAddress);

  let id = getVotingEscrowId(userAddress, event.address);
  let votingShare = VotingEscrowLock.load(id);

  if (votingShare == null) return;

  votingShare = new VotingEscrowLock(id);
  votingShare.user = userAddress.toHexString();
  votingShare.votingEscrowID = event.address.toHexString();
  votingShare.lockedBalance = ZERO_BD;
  votingShare.updatedAt = event.block.timestamp.toI32();
  votingShare.save();
}

export function handleSupply(event: Supply): void {
  let id = event.address.toHexString();
  let votingEscrow = VotingEscrow.load(id);

  if (votingEscrow == null) {
    votingEscrow = new VotingEscrow(id);
  }

  votingEscrow.stakedSupply = scaleDownBPT(event.params.supply);
  votingEscrow.save();
}
