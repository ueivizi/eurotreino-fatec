import { Camera, Map, NativeUserLocation, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { useProfile } from '@/features/auth/session';
import { formatDistance } from '@/features/workouts/metrics';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

import { CET_CREDIT, CYCLE_COLORS, CYCLE_LEGEND, cyclewayLabel } from './cycleways';
import { CyclewayLayers, PLACE_LAYER, PlaceLayers, RouteLine, TAPPABLE_LAYERS } from './map-layers';
import { DEFAULT_CENTER, MAP_CREDIT, MAP_STYLES } from './map-style';
import { PLACE_COLORS, PLACE_KINDS, nearbyPlaces, placeKindOf, placeLabel, type NearbyPlace, type PlaceKind } from './places';
import { routeBounds, type RoutePoint } from './route';
import {
  LOOP_DISTANCES,
  ROUTING_CREDIT,
  ROUTING_MODALITIES,
  describeRoutedPath,
  generateLoops,
  type RoutedPath,
  type RoutingModality,
} from './routing-api';
import { loadRoutes, storeRoutes, withRoute, type SavedRoute } from './saved-routes';
import { useMyLocation } from './use-my-location';

export const EXPLORE_MAP_AVAILABLE = true;

type Panel = 'rotas' | 'perto';

const PANELS = [
  { id: 'rotas', label: 'Rotas' },
  { id: 'perto', label: 'Perto de você' },
] as const satisfies readonly { id: Panel; label: string }[];

/** O que faz sentido no meio de um treino: água, bicicletaria e um café para o fim. */
const FIRST_PLACES: PlaceKind[] = ['agua', 'bicicletaria', 'cafe'];
/** Abaixo disso o mapa base não traz os lugares. */
const PLACES_MIN_ZOOM = 13;

const fitPadding = { top: 120, right: 48, bottom: 48, left: 48 };

/**
 * Aba Mapa (quadro 8.4 ampliado): onde a pessoa está, as ciclovias, os lugares por perto e as rotas
 * para treinar. A posição só aparece com a escolha "Localização" ligada e fica no aparelho.
 */
export function ExploreMap() {
  const { colors, name } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useProfile();
  const focused = useIsFocused();
  const locationChoice = Boolean(profile?.locationConsentAt);
  const location = useMyLocation(locationChoice && focused);

  const map = useRef<MapRef>(null);
  const camera = useRef<CameraRef>(null);
  const centered = useRef(false);

  const [cycleways, setCycleways] = useState(true);
  const [placeKinds, setPlaceKinds] = useState<PlaceKind[]>([]);
  const [panel, setPanel] = useState<Panel>('rotas');
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [zoom, setZoom] = useState(12);
  const [center, setCenter] = useState<RoutePoint>({ lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] });
  const [tapped, setTapped] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [loopModality, setLoopModality] = useState<RoutingModality>('pe');
  const [loopDistance, setLoopDistance] = useState<number>(5_000);
  const [loops, setLoops] = useState<RoutedPath[]>([]);
  const [loopIndex, setLoopIndex] = useState(0);
  const variation = useRef(0);
  const [saveError, setSaveError] = useState(false);

  const myPosition = location.status === 'ativa' ? location.position : null;
  const selected = routes.find((route) => route.id === selectedId) ?? null;
  const chosenLoop = loops[loopIndex] ?? null;

  // Voltas geradas pelo roteador: começam e terminam na pessoa (ou no centro do mapa, sem posição).
  const generate = useMutation({
    mutationFn: (start: RoutePoint) => generateLoops(loopModality, start, loopDistance, variation.current),
    onSuccess: (paths) => {
      variation.current += 1;
      setLoops(paths);
      setLoopIndex(0);
      setSelectedId(null);
      setFollowing(false);
      const bounds = routeBounds(paths.flatMap((path) => path.points));
      if (bounds) camera.current?.fitBounds(bounds, { padding: fitPadding, duration: 600 });
    },
  });

  // As rotas moram no aparelho e mudam em outras telas (desenhar, fim do treino): relê ao voltar.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadRoutes()
        .then((saved) => {
          if (alive) setRoutes(saved);
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, []),
  );

  // Na primeira posição, o mapa vai até a pessoa; depois ela move o mapa como quiser.
  useEffect(() => {
    if (!myPosition || centered.current) return;
    centered.current = true;
    camera.current?.flyTo({ center: [myPosition.lng, myPosition.lat], zoom: 15, duration: 800 });
  }, [myPosition]);

  // De onde contar a distância dos lugares: da pessoa, ou do centro do mapa quando não há posição.
  const origin = useRef<RoutePoint>(center);
  useEffect(() => {
    origin.current = myPosition ?? center;
  }, [myPosition, center]);

  const refreshNearby = useCallback(async () => {
    if (placeKinds.length === 0) return;
    const features = (await map.current?.queryRenderedFeatures({ layers: [PLACE_LAYER] })) ?? [];
    setNearby(nearbyPlaces(features, origin.current));
  }, [placeKinds]);

  // Categoria nova: espera o mapa desenhar os pontos antes de ler a lista.
  useEffect(() => {
    if (placeKinds.length === 0) return;
    const timer = setTimeout(() => void refreshNearby().catch(() => undefined), 450);
    return () => clearTimeout(timer);
  }, [placeKinds, refreshNearby]);

  function openPanel(next: Panel) {
    setPanel(next);
    if (next === 'perto' && placeKinds.length === 0) setPlaceKinds(FIRST_PLACES);
  }

  function togglePlace(kind: PlaceKind) {
    setPlaceKinds((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]));
  }

  function select(route: SavedRoute) {
    setLoops([]);
    setSelectedId(route.id);
    setFollowing(false);
    const bounds = routeBounds(route.points);
    if (bounds) camera.current?.fitBounds(bounds, { padding: fitPadding, duration: 600 });
  }

  function locate() {
    if (!locationChoice) {
      setLocationHint('Ligue a Localização em Suas escolhas para ver onde você está.');
      return;
    }
    if (location.status === 'negada') {
      setLocationHint('A localização está bloqueada no celular. Libere para o EuroTreino nas configurações do aparelho.');
      return;
    }
    if (!myPosition) {
      setLocationHint('Buscando sua posição…');
      return;
    }
    setLocationHint(null);
    setFollowing(true);
    camera.current?.flyTo({ center: [myPosition.lng, myPosition.lat], zoom: 16, duration: 600 });
  }

  async function describeTap(point: [number, number]) {
    const features = (await map.current?.queryRenderedFeatures(point, { layers: TAPPABLE_LAYERS })) ?? [];
    for (const feature of features) {
      const properties = (feature.properties ?? {}) as Record<string, unknown>;
      const kind = placeKindOf(properties.subclass);
      if (kind) {
        const raw = properties['name:pt'] ?? properties.name;
        const label = typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 60) : null;
        setTapped(label ? `${placeLabel(kind)} · ${label}` : placeLabel(kind));
        return;
      }
      const way = cyclewayLabel(properties);
      if (way) {
        setTapped(way);
        return;
      }
      if (properties.subclass === 'cycleway' || properties.bicycle === 'designated') {
        setTapped('Ciclovia');
        return;
      }
    }
    setTapped(null);
  }

  /** Guarda a volta escolhida nas rotas do aparelho; devolve o id, ou nulo se não deu. */
  async function keepLoop(loop: RoutedPath): Promise<string | null> {
    const route: SavedRoute = {
      id: randomUUID(),
      name: `Volta de ${formatDistance(loop.distanceM)}${loopModality === 'bike' ? ' de bike' : ''}`,
      points: loop.points,
      distanceM: loop.distanceM,
      savedAt: new Date().toISOString(),
    };
    const next = withRoute(routes, route);
    try {
      await storeRoutes(next);
      setRoutes(next);
      setSaveError(false);
      return route.id;
    } catch {
      setSaveError(true);
      return null;
    }
  }

  async function trainOnLoop(loop: RoutedPath) {
    const id = await keepLoop(loop);
    if (id) router.push({ pathname: '/sessao', params: { rota: id, tipo: loopModality === 'bike' ? 'bike' : 'corrida' } });
  }

  async function saveLoop(loop: RoutedPath) {
    const id = await keepLoop(loop);
    if (!id) return;
    setLoops([]);
    setSelectedId(id);
  }

  const cycleColors = CYCLE_COLORS[name];
  const placeColors = PLACE_COLORS[name];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.mapArea}>
        <Map
          ref={map}
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLES[name]}
          logo={false}
          attribution={false}
          compass={false}
          touchPitch={false}
          onPress={(event) => void describeTap(event.nativeEvent.point).catch(() => setTapped(null))}
          onRegionDidChange={(event) => {
            const { center: [lng, lat], zoom: nextZoom, userInteraction } = event.nativeEvent;
            setZoom(nextZoom);
            setCenter({ lng, lat });
            if (!myPosition) origin.current = { lng, lat };
            if (userInteraction) setFollowing(false);
            void refreshNearby().catch(() => undefined);
          }}>
          <Camera
            ref={camera}
            initialViewState={{ center: DEFAULT_CENTER, zoom: 12 }}
            trackUserLocation={following && myPosition ? 'default' : undefined}
            onTrackUserLocationChange={(event) => {
              if (event.nativeEvent.trackUserLocation === null) setFollowing(false);
            }}
          />
          <CyclewayLayers visible={cycleways} />
          <PlaceLayers kinds={placeKinds} />
          {loops.map((loop, index) =>
            index === loopIndex ? null : <RouteLine key={`volta-${index}`} id={`volta-${index}`} points={loop.points} color={colors.textMuted} width={3} />,
          )}
          {chosenLoop ? <RouteLine id="volta-escolhida" points={chosenLoop.points} color={colors.goldHighlight} width={5} /> : null}
          {selected ? <RouteLine id="rota-escolhida" points={selected.points} color={colors.goldHighlight} /> : null}
          {myPosition ? <NativeUserLocation mode="heading" /> : null}
        </Map>

        <View style={[styles.topBar, { top: insets.top + space.sm }]} pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
            <PressableScale
              accessibilityRole="switch"
              accessibilityLabel="Mostrar ciclovias"
              accessibilityState={{ checked: cycleways }}
              haptic="select"
              onPress={() => setCycleways((value) => !value)}
              style={[
                styles.floatingChip,
                { backgroundColor: colors.surfaceRaised, borderColor: cycleways ? cycleColors.ciclovia : colors.hairline },
              ]}>
              <Icon name="bike" size={18} color={cycleways ? cycleColors.ciclovia : colors.textMuted} />
              <AppText variant="label" tone={cycleways ? 'primary' : 'muted'}>Ciclovias</AppText>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={following ? 'Seguindo sua posição' : 'Mostrar onde estou'}
              haptic="tap"
              onPress={locate}
              style={[styles.roundButton, { backgroundColor: colors.surfaceRaised, borderColor: following ? colors.gold : colors.hairline }]}>
              <Icon name="mira" size={22} color={following ? colors.goldHighlight : colors.textSecondary} />
            </PressableScale>
          </View>
          {cycleways ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legend}>
              {CYCLE_LEGEND.map((item) => (
                <View key={item.id} style={[styles.legendItem, { backgroundColor: colors.surfaceRaised }]} accessible accessibilityLabel={`${item.label}: ${item.hint}`}>
                  <View
                    style={[
                      item.id === 'bicicletario' ? styles.legendDot : styles.legendLine,
                      { backgroundColor: cycleColors[item.id], opacity: item.id === 'ciclorrota' ? 0.7 : 1 },
                    ]}
                  />
                  <AppText variant="caption" tone="secondary">{item.label}</AppText>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {locationHint ? (
            <Pressable accessibilityRole="button" onPress={() => (locationChoice ? setLocationHint(null) : router.push('/escolhas'))}>
              <View style={[styles.hint, { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline }]}>
                <AppText variant="caption" tone="secondary" style={styles.flex}>{locationHint}</AppText>
                <AppText variant="caption" tone="gold">{locationChoice ? 'Ok' : 'Abrir'}</AppText>
              </View>
            </Pressable>
          ) : null}
        </View>

        {tapped ? (
          <Reveal style={[styles.tapped, { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline }]}>
            <AppText variant="label" numberOfLines={2} style={styles.flex}>{tapped}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12} onPress={() => setTapped(null)}>
              <Icon name="fechar" size={16} color={colors.textMuted} />
            </Pressable>
          </Reveal>
        ) : null}

        <View style={[styles.credit, { backgroundColor: colors.background }]} pointerEvents="none">
          <AppText variant="caption" tone="muted">{cycleways ? `${MAP_CREDIT} · CET/SP` : MAP_CREDIT}</AppText>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.hairlineSoft }]}>
        <SegmentedControl options={PANELS} value={panel} onChange={openPanel} accessibilityLabel="Painel do mapa" />
        <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
          {panel === 'rotas' ? (
            <>
              {selected ? (
                <View style={[styles.selected, { borderColor: colors.gold, backgroundColor: colors.selectedFill }]}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <AppText variant="bodyMedium" numberOfLines={1}>{selected.name}</AppText>
                      <AppText variant="caption" tone="secondary">{formatDistance(selected.distanceM)}</AppText>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Tirar a rota do mapa" hitSlop={12} onPress={() => setSelectedId(null)}>
                      <Icon name="fechar" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <Button
                    label="Treinar com esta rota"
                    icon="registrar"
                    onPress={() => router.push({ pathname: '/sessao', params: { rota: selected.id } })}
                  />
                  <Button label="Editar no mapa" variant="ghost" onPress={() => router.push({ pathname: '/rota', params: { id: selected.id } })} />
                </View>
              ) : (
                <Button label="Criar rota" icon="mais" variant="secondary" onPress={() => router.push('/rota')} />
              )}

              <AppText variant="overline" tone="muted">Voltas perto de você</AppText>
              <SegmentedControl
                options={ROUTING_MODALITIES}
                value={loopModality}
                onChange={(next) => {
                  setLoopModality(next);
                  setLoops([]);
                }}
                accessibilityLabel="Volta a pé ou de bike"
              />
              <View style={styles.chipRow}>
                {LOOP_DISTANCES.map((meters) => {
                  const on = meters === loopDistance;
                  return (
                    <PressableScale
                      key={meters}
                      haptic="select"
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`Volta de ${formatDistance(meters)}`}
                      onPress={() => {
                        setLoopDistance(meters);
                        setLoops([]);
                      }}
                      style={[styles.chip, { borderColor: on ? colors.gold : colors.hairlineSoft, backgroundColor: on ? colors.selectedFill : 'transparent' }]}>
                      <AppText variant="label" tone={on ? 'goldHighlight' : 'secondary'}>{formatDistance(meters)}</AppText>
                    </PressableScale>
                  );
                })}
              </View>
              <Button
                label={generate.isPending ? 'Gerando voltas…' : loops.length > 0 ? 'Outras voltas' : 'Gerar voltas'}
                icon="repetir"
                variant="secondary"
                disabled={generate.isPending}
                onPress={() => generate.mutate(myPosition ?? center)}
              />
              <AppText variant="caption" tone="muted">
                {`${myPosition ? 'Começam e terminam onde você está.' : 'Começam no centro do mapa.'} O ponto de partida vai ao OpenRouteService (HeiGIT) pelo nosso servidor, sem a sua conta.`}
              </AppText>
              {generate.isError ? <Notice tone="danger" message={errorMessage(generate.error)} /> : null}
              {loops.map((loop, index) => {
                const on = index === loopIndex;
                return (
                  <PressableScale
                    key={`opcao-${index}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`Volta ${index + 1}: ${describeRoutedPath(loop, formatDistance)}`}
                    onPress={() => setLoopIndex(index)}
                    style={[styles.item, { borderBottomColor: colors.hairlineSoft }]}>
                    <View style={[styles.legendLine, { backgroundColor: on ? colors.goldHighlight : colors.textMuted }]} />
                    <View style={styles.flex}>
                      <AppText variant="bodyMedium" tone={on ? 'goldHighlight' : 'primary'}>{`Volta ${index + 1}`}</AppText>
                      <AppText variant="caption" tone="secondary">{describeRoutedPath(loop, formatDistance)}</AppText>
                    </View>
                  </PressableScale>
                );
              })}
              {chosenLoop ? (
                <>
                  <Button label="Treinar nesta volta" icon="registrar" onPress={() => void trainOnLoop(chosenLoop)} />
                  <Button label="Guardar nas minhas rotas" variant="ghost" onPress={() => void saveLoop(chosenLoop)} />
                  <AppText variant="caption" tone="muted">{ROUTING_CREDIT}</AppText>
                </>
              ) : null}
              {saveError ? <Notice tone="danger" message="Não foi possível guardar a rota neste aparelho." /> : null}

              <AppText variant="overline" tone="muted">Suas rotas</AppText>
              {routes.length === 0 ? (
                <AppText variant="caption" tone="muted">
                  Desenhe um trajeto ou guarde o percurso do GPS no fim de um treino: suas rotas aparecem aqui.
                </AppText>
              ) : (
                routes.map((route) => (
                  <PressableScale
                    key={route.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: route.id === selectedId }}
                    accessibilityLabel={`${route.name}, ${formatDistance(route.distanceM)}`}
                    onPress={() => select(route)}
                    style={[styles.item, { borderBottomColor: colors.hairlineSoft }]}>
                    <Icon name="mapa" size={18} color={route.id === selectedId ? colors.goldHighlight : colors.textMuted} />
                    <AppText variant="bodyMedium" numberOfLines={1} style={styles.flex}>{route.name}</AppText>
                    <AppText variant="label" tone="secondary" style={styles.tabular}>{formatDistance(route.distanceM)}</AppText>
                  </PressableScale>
                ))
              )}
            </>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {PLACE_KINDS.map((kind) => {
                  const on = placeKinds.includes(kind.id);
                  return (
                    <PressableScale
                      key={kind.id}
                      haptic="select"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={kind.label}
                      onPress={() => togglePlace(kind.id)}
                      style={[
                        styles.chip,
                        { borderColor: on ? placeColors[kind.id] : colors.hairlineSoft, backgroundColor: on ? colors.selectedFill : 'transparent' },
                      ]}>
                      <View style={[styles.legendDot, { backgroundColor: placeColors[kind.id] }]} />
                      <AppText variant="label" tone={on ? 'primary' : 'secondary'}>{kind.label}</AppText>
                    </PressableScale>
                  );
                })}
              </ScrollView>

              {!locationChoice ? (
                <Notice message="Sem a sua posição, a distância é contada do centro do mapa. Dá para ligar a Localização em Suas escolhas." />
              ) : null}

              {placeKinds.length === 0 ? (
                <AppText variant="caption" tone="muted">Escolha o que procurar.</AppText>
              ) : zoom < PLACES_MIN_ZOOM ? (
                <AppText variant="caption" tone="muted">Aproxime o mapa para ver os lugares.</AppText>
              ) : nearby.length === 0 ? (
                <AppText variant="caption" tone="muted">Nada disso nesta parte do mapa.</AppText>
              ) : (
                nearby.map((place) => (
                  <PressableScale
                    key={place.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${place.name}, ${placeLabel(place.kind)}, a ${formatDistance(place.distanceM)}`}
                    onPress={() => {
                      setFollowing(false);
                      setTapped(place.name === placeLabel(place.kind) ? place.name : `${placeLabel(place.kind)} · ${place.name}`);
                      camera.current?.flyTo({ center: [place.point.lng, place.point.lat], zoom: 17, duration: 600 });
                    }}
                    style={[styles.item, { borderBottomColor: colors.hairlineSoft }]}>
                    <View style={[styles.legendDot, { backgroundColor: placeColors[place.kind] }]} />
                    <View style={styles.flex}>
                      <AppText variant="bodyMedium" numberOfLines={1}>{place.name}</AppText>
                      <AppText variant="caption" tone="muted">{placeLabel(place.kind)}</AppText>
                    </View>
                    <AppText variant="label" tone="secondary" style={styles.tabular}>{formatDistance(place.distanceM)}</AppText>
                  </PressableScale>
                ))
              )}
              <AppText variant="caption" tone="muted">{`Lugares do OpenStreetMap. ${CET_CREDIT}.`}</AppText>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  mapArea: {
    flex: 1,
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    gap: space.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingChip: {
    minHeight: touchTarget - 4,
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  roundButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    gap: space.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.full,
  },
  legendLine: {
    width: 16,
    height: 4,
    borderRadius: 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  tapped: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  credit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: space.xs,
    opacity: 0.85,
  },
  panel: {
    maxHeight: '44%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  panelScroll: {
    flexGrow: 0,
  },
  panelContent: {
    gap: space.sm,
    paddingBottom: space.lg,
  },
  selected: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  item: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chips: {
    gap: space.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: touchTarget - 8,
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  flex: {
    flex: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
