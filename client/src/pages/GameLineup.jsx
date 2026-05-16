import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../api';
import { Spinner, Btn } from '../components/ui';

// ── Shared utilities ─────────────────────────────────────────────────────────

function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function computePlayerStats(players, lineupArr, subsArr, attendanceArr, timerSeconds, firstHalfDuration, secondHalfStarted, preferredRestMinutes) {
  const lineupMap     = Object.fromEntries(lineupArr.map(l => [l.player_id, l.position]));
  const attendanceMap = Object.fromEntries(attendanceArr.map(a => [a.player_id, a]));
  const firstHalfDur  = firstHalfDuration ?? 0;

  const pState = {};
  for (const p of players) {
    const pos = lineupMap[p.id];
    if (!pos) continue;
    pState[p.id] = {
      player_id: p.id, name: p.name, jersey_number: p.jersey_number,
      field_seconds: 0, bench_seconds: 0,
      swaps_count: 0, current_position: pos, last_change_at: 0,
    };
  }

  const sorted = [...subsArr].sort((a, b) => a.elapsed_seconds - b.elapsed_seconds || a.id - b.id);
  for (const sub of sorted) {
    const off = pState[sub.player_off_id];
    const on  = pState[sub.player_on_id];
    if (off) {
      if (off.current_position === 'field' || off.current_position === 'goalie')
        off.field_seconds += Math.max(0, sub.elapsed_seconds - off.last_change_at);
      else
        off.bench_seconds += Math.max(0, sub.elapsed_seconds - off.last_change_at);
      off.last_change_at   = sub.elapsed_seconds;
      off.current_position = 'bench';
      off.swaps_count++;
    }
    if (on) {
      if (on.current_position === 'bench')
        on.bench_seconds += Math.max(0, sub.elapsed_seconds - on.last_change_at);
      else
        on.field_seconds += Math.max(0, sub.elapsed_seconds - on.last_change_at);
      on.last_change_at   = sub.elapsed_seconds;
      on.current_position = sub.is_goalie_swap ? 'goalie' : 'field';
      on.swaps_count++;
    }
  }

  const result = {};
  for (const s of Object.values(pState)) {
    const att              = attendanceMap[s.player_id] ?? {};
    const wantsExtraRest   = att.wants_extra_rest ?? false;
    const extensionMinutes = att.extra_rest_extension_minutes ?? 0;

    let fieldSec = s.field_seconds;
    let benchSec = s.bench_seconds;
    let benchSecCurrentStint = 0;

    if (s.current_position === 'field' || s.current_position === 'goalie') {
      fieldSec += Math.max(0, timerSeconds - s.last_change_at);
    } else if (secondHalfStarted && s.last_change_at < firstHalfDur) {
      const fhb = Math.max(0, firstHalfDur - s.last_change_at);
      const shb = Math.max(0, timerSeconds - firstHalfDur);
      benchSec += fhb + shb;
      benchSecCurrentStint = shb;
    } else {
      const curr = Math.max(0, timerSeconds - s.last_change_at);
      benchSec += curr;
      benchSecCurrentStint = curr;
    }

    const effectiveRestTargetSeconds =
      (preferredRestMinutes + extensionMinutes + (wantsExtraRest ? 2 : 0)) * 60;

    result[s.player_id] = {
      player_id: s.player_id,
      name: s.name,
      jersey_number: s.jersey_number,
      field_seconds: fieldSec,
      bench_seconds: benchSec,
      swaps_count: s.swaps_count,
      current_position: s.current_position,
      bench_seconds_current_stint: benchSecCurrentStint,
      effective_rest_target_seconds: effectiveRestTargetSeconds,
      wants_extra_rest: wantsExtraRest,
      extra_rest_extension_minutes: extensionMinutes,
    };
  }
  return result;
}

// ── Scheduled: Attendance + Lineup steps ─────────────────────────────────────

function ScheduledLineupView({ game, myTeamPlayers, squadSize, toast, onLineupSaved }) {
  const [step,       setStep]       = useState('attendance');
  const [attendance, setAttendance] = useState({});
  const [lineupMap,  setLineupMap]  = useState({});
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    Promise.all([
      api.getGameAttendance(game.id),
      api.getGameLineup(game.id),
    ]).then(([attRows, lineupRows]) => {
      const attMap = {};
      for (const r of attRows) attMap[r.player_id] = { is_present: r.is_present, wants_extra_rest: r.wants_extra_rest };
      setAttendance(attMap);
      if (lineupRows.length > 0) {
        const lm = {};
        for (const l of lineupRows) lm[l.player_id] = l.position;
        setLineupMap(lm);
        setStep('lineup');
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [game.id]);

  const presentPlayers = myTeamPlayers.filter(p => attendance[p.id]?.is_present);
  const presentCount   = presentPlayers.length;

  async function confirmAttendance() {
    setSaving(true);
    try {
      const entries = myTeamPlayers.map(p => ({
        player_id: p.id,
        is_present: attendance[p.id]?.is_present ?? false,
        wants_extra_rest: attendance[p.id]?.wants_extra_rest ?? false,
      }));
      await api.saveGameAttendance(game.id, entries);
      const lm = {};
      for (const p of presentPlayers) lm[p.id] = lineupMap[p.id] ?? 'bench';
      setLineupMap(lm);
      setStep('lineup');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const onField    = presentPlayers.filter(p => lineupMap[p.id] === 'field' || lineupMap[p.id] === 'goalie');
  const onBench    = presentPlayers.filter(p => !lineupMap[p.id] || lineupMap[p.id] === 'bench');
  const goalieId   = presentPlayers.find(p => lineupMap[p.id] === 'goalie')?.id;
  const fieldCount = onField.length;

  function cyclePosition(playerId) {
    const current = lineupMap[playerId] ?? 'bench';
    let next = current === 'bench' ? 'field' : current === 'field' ? 'goalie' : 'bench';
    setLineupMap(prev => {
      const updated = { ...prev };
      if (next === 'goalie' && goalieId && goalieId !== playerId) {
        updated[goalieId] = 'field';
      }
      updated[playerId] = next;
      return updated;
    });
  }

  async function saveLineup() {
    if (!goalieId) { toast('Must have exactly one goalie', 'error'); return; }
    if (squadSize && fieldCount !== squadSize) {
      toast(`Need ${squadSize} on field (including goalie), currently ${fieldCount}`, 'error');
      return;
    }
    const entries = presentPlayers.map(p => ({ player_id: p.id, position: lineupMap[p.id] ?? 'bench' }));
    setSaving(true);
    try {
      await api.saveGameLineup(game.id, entries);
      toast('Lineup saved!');
      onLineupSaved?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6"><Spinner /></div>;

  // ── Step 1: Attendance ────────────────────────────────────────────────────
  if (step === 'attendance') {
    return (
      <div className="p-4 space-y-3 max-w-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide">Step 1 — Attendance</h2>
          <span className="text-sm text-gray-500">{presentCount} of {myTeamPlayers.length} available</span>
        </div>

        {squadSize != null && presentCount < squadSize && presentCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
            ⚠ Only {presentCount} available — you need {squadSize} to fill the field
          </div>
        )}

        <div className="space-y-2">
          {myTeamPlayers.map(p => {
            const att = attendance[p.id] ?? { is_present: false, wants_extra_rest: false };
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-bebas text-pitch-400 text-xl w-8 text-center shrink-0">#{p.jersey_number}</span>
                  <span className="flex-1 font-medium text-pitch-900 text-sm">{p.name}</span>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={att.is_present}
                      onChange={e => setAttendance(prev => ({
                        ...prev,
                        [p.id]: { ...att, is_present: e.target.checked, wants_extra_rest: e.target.checked ? att.wants_extra_rest : false },
                      }))}
                      className="w-4 h-4 rounded accent-pitch-700"
                    />
                    <span className="text-sm text-gray-700">Present</span>
                  </label>
                </div>
                {att.is_present && (
                  <div className="mt-2 ml-11">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => setAttendance(prev => ({
                          ...prev,
                          [p.id]: { ...att, wants_extra_rest: !att.wants_extra_rest },
                        }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${att.wants_extra_rest ? 'bg-amber-400' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${att.wants_extra_rest ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                      <span className="text-sm text-gray-500">😴 Needs extra rest today</span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Btn variant="primary" className="w-full" onClick={confirmAttendance} disabled={saving || presentCount === 0}>
          {saving ? 'Saving…' : 'Confirm Attendance'}
        </Btn>
      </div>
    );
  }

  // ── Step 2: Set Lineup ────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-3 max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide">Step 2 — Starting Lineup</h2>
          <p className="text-xs text-gray-400">Tap to cycle: Bench → Field → Goalie</p>
        </div>
        <button onClick={() => setStep('attendance')} className="text-sm text-pitch-400 hover:text-pitch-700">← Back</button>
      </div>

      <div className="text-sm text-gray-500 flex items-center gap-2">
        <span>{fieldCount} / {squadSize ?? '?'} on field</span>
        {!goalieId && fieldCount > 0 && <span className="text-amber-600 text-xs">· no goalie set</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* ON FIELD column */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-2">On Field</p>

          {/* Goalie slot */}
          {goalieId ? (
            <div className="mb-2">
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-1">🧤 Goalie</p>
              {presentPlayers.filter(p => p.id === goalieId).map(p => (
                <button key={p.id} onClick={() => cyclePosition(p.id)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl border-2 border-amber-400 bg-amber-50 text-left"
                >
                  <span className="font-bebas text-amber-600 text-lg w-7 text-center shrink-0">#{p.jersey_number}</span>
                  <span className="flex-1 text-xs font-medium text-pitch-900 truncate">{p.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-2 p-2.5 rounded-xl border-2 border-dashed border-amber-200 text-center">
              <p className="text-xs text-amber-400">No goalie</p>
            </div>
          )}

          <div className="space-y-1.5">
            {presentPlayers.filter(p => lineupMap[p.id] === 'field').map(p => (
              <button key={p.id} onClick={() => cyclePosition(p.id)}
                className="w-full flex items-center gap-2 p-2.5 rounded-xl border-2 border-pitch-700 bg-pitch-50 text-left"
              >
                <span className="font-bebas text-pitch-600 text-lg w-7 text-center shrink-0">#{p.jersey_number}</span>
                <span className="flex-1 text-xs font-medium text-pitch-900 truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* BENCH column */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Bench</p>
          <div className="space-y-1.5">
            {onBench.map(p => (
              <button key={p.id} onClick={() => cyclePosition(p.id)}
                className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-left hover:border-gray-300 transition-colors"
              >
                <span className="font-bebas text-gray-400 text-lg w-7 text-center shrink-0">#{p.jersey_number}</span>
                <span className="flex-1 text-xs font-medium text-gray-600 truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Btn variant="primary" className="w-full" onClick={saveLineup} disabled={saving || !goalieId}>
        {saving ? 'Saving…' : 'Save Lineup'}
      </Btn>
    </div>
  );
}

// ── Live: Substitution management ────────────────────────────────────────────

function BenchCard({ stat, extended, preferredRestMinutes, maxRestMinutes, onSubOn, onExtendRest, isSelectedForSubOff }) {
  const { bench_seconds_current_stint: bsc, effective_rest_target_seconds: target } = stat;
  const maxTargetSec = (maxRestMinutes + (stat.extra_rest_extension_minutes ?? 0) + (stat.wants_extra_rest ? 2 : 0)) * 60;
  const isReady    = bsc >= target;
  const isOverdue  = bsc >= maxTargetSec;

  const restTargetLabel = (() => {
    const base = preferredRestMinutes;
    const ext  = stat.extra_rest_extension_minutes ?? 0;
    const bonus = stat.wants_extra_rest ? 2 : 0;
    const parts = [`${base} min`];
    if (ext > 0)   parts.push(`+${ext}`);
    if (bonus > 0) parts.push(`+${bonus}`);
    return parts.join(' ');
  })();

  const border = isOverdue
    ? 'border-2 border-orange-400 bg-orange-50'
    : isReady
    ? 'border-2 border-emerald-400 bg-emerald-50'
    : 'border border-gray-200 bg-white';

  return (
    <div className={`rounded-xl p-3 space-y-2 ${border} ${isSelectedForSubOff ? 'ring-2 ring-pitch-500' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="font-bebas text-gray-400 text-xl w-8 text-center shrink-0">#{stat.jersey_number}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-pitch-900 text-sm truncate">
            {stat.name}
            {stat.wants_extra_rest && <span className="ml-1 text-amber-500 text-xs">😴</span>}
          </p>
          <p className="text-[11px] text-gray-400">⏱ {formatTimer(bsc)}</p>
        </div>
      </div>

      {isOverdue && (
        <p className="text-[10px] font-bold text-orange-600">⚠ Overdue for rotation</p>
      )}
      {isReady && !isOverdue && (
        <p className="text-[10px] font-bold text-emerald-600">✓ Ready to come on</p>
      )}

      <div className="flex items-center justify-between gap-1.5">
        <p className="text-[10px] text-gray-400 truncate">Rest target: {restTargetLabel}</p>
        <button
          onClick={onExtendRest}
          className="shrink-0 text-[10px] font-bold text-pitch-600 hover:text-pitch-900 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition-colors"
        >
          +1 min
        </button>
      </div>

      <button
        onClick={onSubOn}
        className="w-full text-xs font-bold py-1.5 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-white transition-colors"
      >
        Sub On
      </button>
    </div>
  );
}

function FieldCard({ stat, isGoalie, onSubOff, isSelectedForSubOff }) {
  const border = isGoalie
    ? 'border-2 border-amber-400 bg-amber-50'
    : isSelectedForSubOff
    ? 'border-2 border-red-400 bg-red-50'
    : 'border-2 border-pitch-700 bg-pitch-50';

  return (
    <div className={`rounded-xl p-3 space-y-2 ${border}`}>
      <div className="flex items-center gap-2">
        <span className={`font-bebas text-xl w-8 text-center shrink-0 ${isGoalie ? 'text-amber-500' : 'text-pitch-500'}`}>
          #{stat.jersey_number}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-pitch-900 text-sm truncate">
            {isGoalie ? '🧤 ' : ''}{stat.name}
          </p>
          <p className="text-[11px] text-gray-400">⏱ {formatTimer(stat.field_seconds)}</p>
        </div>
      </div>
      {!isGoalie && (
        <button
          onClick={onSubOff}
          className={`w-full text-xs font-bold py-1.5 rounded-lg transition-colors ${
            isSelectedForSubOff
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-pitch-800'
          }`}
        >
          {isSelectedForSubOff ? '✕ Cancel' : 'Sub Off'}
        </button>
      )}
    </div>
  );
}

function LiveLineupView({ game, timerSeconds, myTeamPlayers, squadSize, preferredRestMinutes, maxRestMinutes, toast }) {
  const [lineup,     setLineup]     = useState([]);
  const [subs,       setSubs]       = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedForSubOff, setSelectedForSubOff] = useState(null);
  const [goaliePickerOpen,  setGoaliePickerOpen]  = useState(false);
  const [dismissedBanners,  setDismissedBanners]  = useState({});

  const loadData = useCallback(async () => {
    try {
      const [l, s, a] = await Promise.all([
        api.getGameLineup(game.id),
        api.getGameSubstitutions(game.id),
        api.getGameAttendance(game.id),
      ]);
      setLineup(l);
      setSubs(s);
      setAttendance(a);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [game.id, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const playerStats = useMemo(() =>
    computePlayerStats(
      myTeamPlayers, lineup, subs, attendance, timerSeconds,
      game.first_half_duration_seconds, !!game.second_half_started_at, preferredRestMinutes,
    ),
    [myTeamPlayers, lineup, subs, attendance, timerSeconds, game.first_half_duration_seconds, game.second_half_started_at, preferredRestMinutes],
  );

  const fieldPlayers = Object.values(playerStats)
    .filter(s => s.current_position === 'field' || s.current_position === 'goalie')
    .sort((a, b) => a.jersey_number - b.jersey_number);
  const benchPlayers = Object.values(playerStats)
    .filter(s => s.current_position === 'bench')
    .sort((a, b) => b.bench_seconds_current_stint - a.bench_seconds_current_stint);

  const readyBannerPlayers = benchPlayers.filter(stat => {
    if (stat.bench_seconds_current_stint < stat.effective_rest_target_seconds) return false;
    const dismissedAt = dismissedBanners[stat.player_id];
    if (dismissedAt == null) return true;
    return stat.bench_seconds_current_stint - dismissedAt >= 120;
  });

  async function makeSub(playerOnId, playerOffId, isGoalieSwap = false) {
    try {
      await api.createSubstitution(game.id, {
        player_on_id: playerOnId,
        player_off_id: playerOffId,
        elapsed_seconds: timerSeconds,
        is_goalie_swap: isGoalieSwap,
      });
      setSelectedForSubOff(null);
      setGoaliePickerOpen(false);
      await loadData();
      toast('Substitution made');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function extendRest(playerId) {
    try {
      const updated = await api.extendPlayerRest(game.id, playerId);
      setAttendance(prev => prev.map(a =>
        a.player_id === playerId
          ? { ...a, extra_rest_extension_minutes: updated.extra_rest_extension_minutes }
          : a
      ));
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function handleSubOff(playerId) {
    setSelectedForSubOff(prev => prev === playerId ? null : playerId);
  }

  function handleSubOn(playerId) {
    if (!selectedForSubOff) return;
    makeSub(playerId, selectedForSubOff, false);
  }

  const goalie = fieldPlayers.find(s => s.current_position === 'goalie');

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="space-y-0">
      {/* Rotation banners */}
      {readyBannerPlayers.length > 0 && (
        <div className="p-3 space-y-2 border-b border-gray-100 bg-emerald-50">
          {readyBannerPlayers.map(stat => (
            <div key={stat.player_id} className="flex items-center justify-between gap-2">
              <p className="text-sm text-emerald-800 flex-1">
                🔄 <strong>{stat.name}</strong> has been resting {Math.floor(stat.bench_seconds_current_stint / 60)} min — ready to come on
              </p>
              <button
                onClick={() => setDismissedBanners(prev => ({ ...prev, [stat.player_id]: stat.bench_seconds_current_stint }))}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-bold shrink-0"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedForSubOff && (
        <div className="px-4 py-2.5 bg-pitch-900 text-white text-sm text-center">
          Select a bench player to come on for <strong>{playerStats[selectedForSubOff]?.name}</strong>
        </div>
      )}

      <div className="grid grid-cols-2 divide-x divide-gray-200">
        {/* ON FIELD */}
        <div className="p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">On Field</p>
          {fieldPlayers.map(stat => (
            <FieldCard
              key={stat.player_id}
              stat={stat}
              isGoalie={stat.current_position === 'goalie'}
              isSelectedForSubOff={selectedForSubOff === stat.player_id}
              onSubOff={() => handleSubOff(stat.player_id)}
            />
          ))}
          {fieldPlayers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No lineup set</p>
          )}
          {/* Goalie swap */}
          {goalie && (
            <button
              onClick={() => setGoaliePickerOpen(true)}
              className="w-full text-xs font-bold py-2 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors mt-1"
            >
              🧤 Swap Goalie
            </button>
          )}
        </div>

        {/* BENCH */}
        <div className="p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Bench</p>
          {benchPlayers.map(stat => (
            <BenchCard
              key={stat.player_id}
              stat={stat}
              preferredRestMinutes={preferredRestMinutes}
              maxRestMinutes={maxRestMinutes}
              isSelectedForSubOff={false}
              onSubOn={() => selectedForSubOff ? handleSubOn(stat.player_id) : undefined}
              onExtendRest={() => extendRest(stat.player_id)}
            />
          ))}
          {benchPlayers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No bench players</p>
          )}
        </div>
      </div>

      {/* Substitution history */}
      {subs.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-2">Substitutions</p>
          <div className="space-y-1.5">
            {[...subs].reverse().map(sub => (
              <div key={sub.id} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                <span>
                  {sub.game_minute}' · <span className="font-medium text-emerald-700">↑ {sub.player_on_name}</span>
                  {' / '}<span className="font-medium text-red-600">↓ {sub.player_off_name}</span>
                  {sub.is_goalie_swap && ' 🧤'}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await api.deleteSubstitution(game.id, sub.id);
                      await loadData();
                      toast('Substitution undone');
                    } catch (e) {
                      toast(e.message, 'error');
                    }
                  }}
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  title="Undo substitution"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goalie picker modal */}
      {goaliePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setGoaliePickerOpen(false)}>
          <div className="fixed inset-0 bg-black/60" />
          <div className="relative bg-white rounded-t-2xl w-full max-w-md p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bebas text-pitch-900 text-2xl tracking-wide">🧤 Swap Goalie</h3>
              <button onClick={() => setGoaliePickerOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 text-xl">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Select bench player to become the new goalie</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {benchPlayers.map(stat => (
                <button
                  key={stat.player_id}
                  onClick={() => goalie && makeSub(stat.player_id, goalie.player_id, true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-pitch-50 hover:border-pitch-300 text-left"
                >
                  <span className="font-bebas text-pitch-500 text-xl w-8 text-center">#{stat.jersey_number}</span>
                  <span className="font-medium text-pitch-900 text-sm">{stat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Halftime: summary + suggested lineup ─────────────────────────────────────

function HalftimeLineupView({ game, myTeamPlayers, squadSize, preferredRestMinutes, toast }) {
  const [playerTime,   setPlayerTime]   = useState(null);
  const [lineupArr,    setLineupArr]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [lineupMap,    setLineupMap]    = useState({});
  const [suggested,    setSuggested]    = useState(false);
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    const elapsed = game.first_half_duration_seconds ?? 0;
    Promise.all([
      api.getPlayerTime(game.id, elapsed),
      api.getGameLineup(game.id),
    ]).then(([pt, lineup]) => {
      setPlayerTime(pt);
      setLineupArr(lineup);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [game.id, game.first_half_duration_seconds]);

  function applySuggested() {
    if (!playerTime) return;
    const sorted = [...playerTime].sort((a, b) => a.field_seconds - b.field_seconds);
    const sq     = squadSize ?? sorted.length;
    const onField = sorted.slice(0, sq);
    const onBench = sorted.slice(sq);

    const currentGoalieId = lineupArr.find(l => l.position === 'goalie')?.player_id;
    const lm = {};
    for (const p of onField) lm[p.player_id] = 'field';
    for (const p of onBench) lm[p.player_id] = 'bench';

    // Assign goalie: prefer current goalie if they're in onField
    const goalieInField = onField.some(p => p.player_id === currentGoalieId);
    if (currentGoalieId && goalieInField) {
      lm[currentGoalieId] = 'goalie';
    } else if (onField.length > 0) {
      lm[onField[0].player_id] = 'goalie';
    }

    setLineupMap(lm);
    setSuggested(true);
  }

  const goalieId = Object.entries(lineupMap).find(([, pos]) => pos === 'goalie')?.[0];
  const fieldCount = Object.values(lineupMap).filter(p => p === 'field' || p === 'goalie').length;

  function toggleFieldBench(playerId) {
    const pid = Number(playerId);
    setLineupMap(prev => {
      const current = prev[pid] ?? 'bench';
      let next = current === 'bench' ? 'field' : current === 'field' ? 'goalie' : 'bench';
      const updated = { ...prev };
      if (next === 'goalie' && goalieId && Number(goalieId) !== pid) {
        updated[Number(goalieId)] = 'field';
      }
      updated[pid] = next;
      return updated;
    });
  }

  async function saveLineup() {
    if (!goalieId) { toast('Must assign a goalie', 'error'); return; }
    const entries = myTeamPlayers
      .filter(p => lineupMap[p.id])
      .map(p => ({ player_id: p.id, position: lineupMap[p.id] }));
    setSaving(true);
    try {
      await api.saveGameLineup(game.id, entries);
      toast('Second half lineup saved!');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6"><Spinner /></div>;

  const sortedStats = playerTime
    ? [...playerTime].sort((a, b) => b.field_seconds - a.field_seconds)
    : [];
  const maxField = sortedStats[0]?.field_seconds || 1;

  return (
    <div className="p-4 space-y-4 max-w-lg">
      {/* First half summary */}
      <div>
        <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">First Half — Field Time</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {sortedStats.map(stat => (
            <div key={stat.player_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
              <span className="font-bebas text-pitch-400 text-base w-8 text-center shrink-0">#{stat.jersey_number}</span>
              <span className="text-sm font-medium text-pitch-900 w-28 truncate shrink-0">{stat.name}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pitch-600 rounded-full transition-all"
                  style={{ width: `${Math.round((stat.field_seconds / maxField) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right shrink-0">{stat.minutes_on_field}'</span>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested lineup */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide">Second Half Lineup</h2>
          {!suggested && (
            <Btn variant="secondary" size="sm" onClick={applySuggested}>
              ✨ Apply Suggested
            </Btn>
          )}
        </div>

        {Object.keys(lineupMap).length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-400 mb-3">Apply the suggested lineup or set one manually</p>
            <Btn variant="primary" size="sm" onClick={applySuggested}>✨ Apply Suggested Lineup</Btn>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-2">Tap a player to cycle: Bench → Field → Goalie</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-2">On Field</p>
                {goalieId && (
                  <div className="mb-2">
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-1">🧤 Goalie</p>
                    {myTeamPlayers.filter(p => p.id === Number(goalieId)).map(p => (
                      <button key={p.id} onClick={() => toggleFieldBench(p.id)}
                        className="w-full flex items-center gap-2 p-2.5 rounded-xl border-2 border-amber-400 bg-amber-50 text-left"
                      >
                        <span className="font-bebas text-amber-600 text-lg w-7 text-center shrink-0">#{p.jersey_number}</span>
                        <span className="flex-1 text-xs font-medium text-pitch-900 truncate">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  {myTeamPlayers.filter(p => lineupMap[p.id] === 'field').map(p => (
                    <button key={p.id} onClick={() => toggleFieldBench(p.id)}
                      className="w-full flex items-center gap-2 p-2.5 rounded-xl border-2 border-pitch-700 bg-pitch-50 text-left"
                    >
                      <span className="font-bebas text-pitch-600 text-lg w-7 text-center shrink-0">#{p.jersey_number}</span>
                      <span className="flex-1 text-xs font-medium text-pitch-900 truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Bench</p>
                <div className="space-y-1.5">
                  {myTeamPlayers.filter(p => lineupMap[p.id] === 'bench').map(p => (
                    <button key={p.id} onClick={() => toggleFieldBench(p.id)}
                      className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-left hover:border-gray-300"
                    >
                      <span className="font-bebas text-gray-400 text-lg w-7 text-center shrink-0">#{p.jersey_number}</span>
                      <span className="flex-1 text-xs font-medium text-gray-600 truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 mt-2">
              {fieldCount} / {squadSize ?? '?'} on field
              {!goalieId && <span className="text-amber-600 text-xs ml-2">· no goalie</span>}
            </div>

            <Btn variant="primary" className="w-full mt-3" onClick={saveLineup} disabled={saving || !goalieId}>
              {saving ? 'Saving…' : 'Save Second Half Lineup'}
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

// ── Complete: full match time summary ────────────────────────────────────────

function CompleteLineupView({ game, toast }) {
  const [playerTime, setPlayerTime] = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    api.getPlayerTime(game.id, game.elapsed_seconds ?? 0)
      .then(setPlayerTime)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [game.id, game.elapsed_seconds]);

  if (loading) return <div className="p-6"><Spinner /></div>;
  if (!playerTime || playerTime.length === 0) {
    return <p className="p-6 text-sm text-gray-400 text-center">No lineup data for this game.</p>;
  }

  const sorted = [...playerTime].sort((a, b) => b.field_seconds - a.field_seconds);

  return (
    <div className="p-4 max-w-lg">
      <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">Match Time Summary</h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {sorted.map(stat => (
          <div key={stat.player_id} className="px-4 py-3 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-bebas text-pitch-400 text-base w-8 text-center shrink-0">#{stat.jersey_number}</span>
              <span className="flex-1 font-semibold text-pitch-900 text-sm">{stat.name}</span>
              {stat.wants_extra_rest && <span className="text-amber-400 text-sm">😴</span>}
            </div>
            <div className="ml-11 grid grid-cols-3 gap-2 text-xs text-gray-500">
              <div>
                <p className="font-bold text-pitch-900">{stat.minutes_on_field}'</p>
                <p>on field</p>
              </div>
              <div>
                <p className="font-bold text-pitch-900">{stat.minutes_on_bench}'</p>
                <p>on bench</p>
              </div>
              <div>
                <p className="font-bold text-pitch-900">{stat.swaps_count}</p>
                <p>sub{stat.swaps_count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function GameLineup({ game, timerSeconds, myTeamPlayers, season, toast, onLineupSaved }) {
  const squadSize            = season?.squad_size            ?? null;
  const preferredRestMinutes = season?.preferred_rest_minutes ?? 5;
  const maxRestMinutes       = season?.max_rest_minutes       ?? 8;

  if (game.status === 'scheduled') {
    return (
      <ScheduledLineupView
        game={game}
        myTeamPlayers={myTeamPlayers}
        squadSize={squadSize}
        toast={toast}
        onLineupSaved={onLineupSaved}
      />
    );
  }

  if (game.status === 'live') {
    return (
      <LiveLineupView
        game={game}
        timerSeconds={timerSeconds}
        myTeamPlayers={myTeamPlayers}
        squadSize={squadSize}
        preferredRestMinutes={preferredRestMinutes}
        maxRestMinutes={maxRestMinutes}
        toast={toast}
      />
    );
  }

  if (game.status === 'halftime') {
    return (
      <HalftimeLineupView
        game={game}
        myTeamPlayers={myTeamPlayers}
        squadSize={squadSize}
        preferredRestMinutes={preferredRestMinutes}
        toast={toast}
      />
    );
  }

  return <CompleteLineupView game={game} toast={toast} />;
}
