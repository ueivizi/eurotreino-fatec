import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { StatusScreen } from '@/components/status-screen';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useProfile } from '@/features/auth/session';
import { rememberDistance } from '@/features/map/pending-distance';
import { MAX_POINTS, addRoutePoint, closeRoute, routeDistanceM, type RoutePoint } from '@/features/map/route';
import { ROUTE_MAP_AVAILABLE, RouteMap } from '@/features/map/route-map';
import { MAX_ROUTES, ROUTE_NAME_MAX, loadRoutes, normalizeRouteName, storeRoutes, withRoute, type SavedRoute } from '@/features/map/saved-routes';
import {
  MAX_WAYPOINTS,
  ROUTING_CREDIT,
  ROUTING_MODALITIES,
  ROUTING_PRIVACY,
  describeRoutedPath,
  routeThrough,
  type RoutedPath,
  type RoutingModality,
} from '@/features/map/routing-api';
import { useMyLocation } from '@/features/map/use-my-location';
import { formatDistance } from '@/features/workouts/metrics';
import { DISTANCE } from '@/features/workouts/workout-types';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

/**
 * Mapa com rota desenhada (P8, quadro 8.4): a pessoa toca o trajeto e o app mede a distância, sem
 * GPS e sem permissão de localização. As rotas ficam guardadas só neste aparelho.
 */
export default function RouteScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ de?: string; id?: string }>();
  const fromRegister = params.de === 'registrar';
  const profile = useProfile();
  const location = useMyLocation(Boolean(profile?.locationConsentAt) && ROUTE_MAP_AVAILABLE);

  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [frame, setFrame] = useState<RoutePoint[] | null>(null);
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [storeError, setStoreError] = useState(false);
  // Pontos tocados são paradas; o roteador devolve o caminho pelas ruas entre elas.
  const [routed, setRouted] = useState<RoutedPath | null>(null);
  const [modality, setModality] = useState<RoutingModality>('pe');
  const snap = useMutation({
    mutationFn: (stops: RoutePoint[]) => routeThrough(modality, stops),
    onSuccess: (path) => setRouted(path),
  });

  useEffect(() => {
    let alive = true;
    void loadRoutes()
      .then((saved) => {
        if (!alive) return;
        setRoutes(saved);
        // Vindo do mapa com uma rota escolhida, ela já abre para editar.
        const asked = saved.find((route) => route.id === params.id);
        if (asked) {
          setPoints(asked.points);
          setFrame(asked.points);
          setLoadedId(asked.id);
          setName(asked.name);
        }
      })
      .catch(() => {
        if (alive) setStoreError(true);
      });
    return () => {
      alive = false;
    };
  }, [params.id]);

  if (!ROUTE_MAP_AVAILABLE) {
    return (
      <StatusScreen
        icon="corrida"
        title="O mapa é do app instalado"
        description="Desenhar rota usa o mapa do celular. Abra o EuroTreino no Android ou no iPhone para medir o trajeto."
        actions={[{ label: 'Voltar', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }]}
      />
    );
  }

  const line = routed?.points ?? points;
  const distanceM = routed?.distanceM ?? routeDistanceM(points);
  const loaded = routes.find((route) => route.id === loadedId) ?? null;
  const usable = points.length >= 2 && distanceM >= DISTANCE.min;

  function edit(next: RoutePoint[]) {
    setPoints(next);
    setRouted(null);
    snap.reset();
    // Mexeu no traçado: a rota carregada vira um desenho novo, salvo com outro nome se quiser.
    setLoadedId(null);
  }

  function load(route: SavedRoute) {
    setRouted(null);
    setPoints(route.points);
    setFrame(route.points);
    setLoadedId(route.id);
    setName(route.name);
  }

  async function persist(next: SavedRoute[]) {
    try {
      await storeRoutes(next);
      setRoutes(next);
      setStoreError(false);
      return true;
    } catch {
      setStoreError(true);
      return false;
    }
  }

  async function save() {
    const route: SavedRoute = {
      id: loaded?.id ?? randomUUID(),
      name: normalizeRouteName(name) || `Rota de ${dayFormat.format(new Date())}`,
      points: line,
      distanceM,
      savedAt: new Date().toISOString(),
    };
    if (await persist(withRoute(routes, route))) {
      // Guardada, a rota traçada vira o próprio desenho: dá para abrir e seguir depois.
      setPoints(route.points);
      setRouted(null);
      setLoadedId(route.id);
      setName(route.name);
    }
  }

  async function remove() {
    if (!loaded) return;
    if (await persist(routes.filter((route) => route.id !== loaded.id))) {
      setLoadedId(null);
      setPoints([]);
      setRouted(null);
      setName('');
    }
  }

  // Só quem veio do Registrar leva a distância de volta: lá a modalidade já foi escolhida.
  function applyToRegister() {
    rememberDistance(distanceM);
    router.back();
  }

  return (
    // O nome da rota fica no painel de baixo: com o teclado aberto, o painel sobe e o mapa encolhe.
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <ScreenHeader
          title="Desenhar rota"
          subtitle={points.length === 0 ? 'Toque no mapa para marcar o trajeto' : `${points.length} ${points.length === 1 ? 'ponto' : 'pontos'} · ${formatDistance(distanceM)}`}
        />
      </View>

      <RouteMap
        points={line}
        waypoints={points}
        frame={frame}
        myPosition={location.status === 'ativa' ? location.position : null}
        onAddPoint={(point) => edit(addRoutePoint(points, point))}
      />

      <ScrollView
        style={[styles.panel, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.hairlineSoft }]}
        contentContainerStyle={[styles.panelContent, { paddingBottom: insets.bottom + space.lg }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.tools}>
          <View style={styles.tool}>
            <Button label="Desfazer" variant="secondary" disabled={points.length === 0} onPress={() => edit(points.slice(0, -1))} />
          </View>
          <View style={styles.tool}>
            <Button label="Fechar volta" variant="secondary" disabled={points.length < 3} onPress={() => edit(closeRoute(points))} />
          </View>
          <View style={styles.tool}>
            <Button label="Limpar" variant="secondary" disabled={points.length === 0} onPress={() => edit([])} />
          </View>
        </View>
        {points.length >= MAX_POINTS ? <Notice message={`O traçado chegou ao limite de ${MAX_POINTS} pontos.`} /> : null}

        <SegmentedControl
          options={ROUTING_MODALITIES}
          value={modality}
          onChange={(next) => {
            setModality(next);
            setRouted(null);
          }}
          accessibilityLabel="Rota a pé ou de bike"
        />
        <Button
          label={snap.isPending ? 'Traçando…' : routed ? 'Traçada pelas ruas' : 'Seguir ruas e ciclovias'}
          icon="mapa"
          variant="secondary"
          disabled={points.length < 2 || points.length > MAX_WAYPOINTS || snap.isPending || routed !== null}
          onPress={() => snap.mutate(points)}
        />
        {routed ? <AppText variant="label" tone="secondary">{describeRoutedPath(routed, formatDistance)}</AppText> : null}
        {snap.isError ? <Notice tone="danger" message={errorMessage(snap.error)} /> : null}
        {points.length > MAX_WAYPOINTS ? <Notice message={`Com mais de ${MAX_WAYPOINTS} pontos, a rota fica como foi desenhada.`} /> : null}
        <AppText variant="caption" tone="muted">{routed ? `${ROUTING_PRIVACY} ${ROUTING_CREDIT}.` : ROUTING_PRIVACY}</AppText>

        {routes.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {routes.map((route) => {
              const selected = route.id === loadedId;
              return (
                <Pressable
                  key={route.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Carregar ${route.name}, ${formatDistance(route.distanceM)}`}
                  onPress={() => load(route)}
                  style={[
                    styles.chip,
                    { borderColor: selected ? colors.gold : colors.hairlineSoft, backgroundColor: selected ? colors.selectedFill : 'transparent' },
                  ]}>
                  <AppText variant="label" tone={selected ? 'goldHighlight' : 'secondary'} numberOfLines={1}>
                    {`${route.name} · ${formatDistance(route.distanceM)}`}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {points.length >= 2 ? (
          <View style={styles.saveRow}>
            <View style={styles.flex}>
              <TextField
                label="Nome da rota"
                value={name}
                onChangeText={setName}
                placeholder="Volta do parque"
                maxLength={ROUTE_NAME_MAX}
                autoCapitalize="sentences"
                returnKeyType="done"
              />
            </View>
            <Button label={loaded ? 'Salvar de novo' : 'Salvar'} variant="secondary" onPress={() => void save()} />
          </View>
        ) : null}
        {storeError ? <Notice tone="danger" message="Não foi possível guardar as rotas neste aparelho. Tente de novo." /> : null}

        {fromRegister ? (
          <Button
            label={usable ? `Usar no registro · ${formatDistance(distanceM)}` : 'Usar no registro'}
            icon="check"
            disabled={!usable}
            onPress={applyToRegister}
          />
        ) : null}
        {loaded ? <Button label="Excluir esta rota" variant="ghost" onPress={() => void remove()} /> : null}

        <AppText variant="caption" tone="muted">
          {`O traçado fica só neste aparelho, até ${MAX_ROUTES} rotas. O mapa vem do OpenFreeMap, que recebe a área que está na tela, nunca o seu trajeto. Ciclovias de São Paulo: CET/Prefeitura (dados abertos).`}
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  panel: {
    flexGrow: 0,
    maxHeight: '48%',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  panelContent: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    gap: space.md,
  },
  tools: {
    flexDirection: 'row',
    gap: space.sm,
  },
  tool: {
    flex: 1,
  },
  chips: {
    gap: space.sm,
  },
  chip: {
    minHeight: touchTarget,
    maxWidth: 240,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
});
