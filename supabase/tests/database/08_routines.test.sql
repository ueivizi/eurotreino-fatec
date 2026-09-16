-- Catálogo de exercícios e fichas de treino: cada ficha é de uma pessoa só, e a lista de exercícios
-- é conferida item a item antes de gravar.

select tests.create_member('rita', 'Rita', 'touro');
select tests.create_member('bruno', 'Bruno', 'leao');

-- caso: o catálogo está completo e é só leitura para quem está autenticado
select tests.assert_true(
  'catálogo tem exercício em todos os grupos musculares',
  (
    select count(distinct e.muscle_group) = (select count(*) from public.muscle_groups)
    from public.exercises as e
    where e.owner_id is null
  )
);
select tests.assert_equal(
  'todo exercício do catálogo aponta para grupo e equipamento existentes',
  (
    select count(*)::integer
    from public.exercises as e
    left join public.muscle_groups as g on g.id = e.muscle_group
    left join public.equipment as q on q.id = e.equipment
    where g.id is null or q.id is null
  ),
  0
);

-- caso: exercício próprio é privado, e o identificador nunca vem do app
select tests.authenticate_as('rita');
select tests.remember(
  'meu_exercicio',
  (select e.id from public.create_exercise('Rosca da Rita', 'biceps', 'halteres') as e)
);
select tests.assert_true(
  'o identificador é gerado pelo servidor, com marca de personalizado',
  tests.recall('meu_exercicio') like 'meu-rosca-da-rita-%'
);
select tests.assert_raises(
  'nome com marcação é recusado',
  $$select * from public.create_exercise('<script>alert(1)</script>', 'biceps', 'halteres')$$,
  'invalid_exercise_name'
);
select tests.assert_raises(
  'grupo muscular inventado',
  $$select * from public.create_exercise('Rosca nova', 'pescoco', 'halteres')$$,
  'invalid_muscle_group'
);
select tests.assert_raises(
  'equipamento inventado',
  $$select * from public.create_exercise('Rosca nova', 'biceps', 'foguete')$$,
  'invalid_equipment'
);

-- caso: ficha com exercícios válidos é salva na ordem
select tests.remember(
  'ficha',
  (
    select r.id::text
    from public.save_routine(
      null,
      'Treino A',
      jsonb_build_array(
        jsonb_build_object('exercise_id', 'supino-reto-barra', 'target_sets', 4, 'target_reps', 8, 'target_load_kg', 60),
        jsonb_build_object('exercise_id', tests.recall('meu_exercicio'), 'target_sets', 3, 'target_reps', 12, 'rest_seconds', 60)
      )
    ) as r
  )
);
select tests.assert_equal(
  'a ficha guarda a ordem e as metas',
  (
    select string_agg(
      format('%s:%sx%s@%s', re.position, re.target_sets, re.target_reps, coalesce(re.target_load_kg::text, '-')),
      ' ' order by re.position
    )
    from public.routine_exercises as re
    where re.routine_id = tests.recall('ficha')::uuid
  ),
  '1:4x8@60.0 2:3x12@-'
);

-- caso: salvar de novo troca a lista inteira, sem sobrar exercício antigo
-- (a gravação da função só aparece no comando seguinte: cada consulta vê o instantâneo do início)
select public.save_routine(
  tests.recall('ficha')::uuid,
  'Treino A',
  jsonb_build_array(jsonb_build_object('exercise_id', 'agachamento-livre', 'target_sets', 5, 'target_reps', 5, 'target_load_kg', 100))
);
select tests.assert_equal(
  'a lista é substituída',
  (
    select string_agg(re.exercise_id, ',' order by re.position)
    from public.routine_exercises as re
    where re.routine_id = tests.recall('ficha')::uuid
  ),
  'agachamento-livre'
);

-- caso: item fora das faixas derruba o salvamento inteiro
select tests.assert_raises(
  'séries demais',
  $$select * from public.save_routine(tests.recall('ficha')::uuid, 'Treino A',
      jsonb_build_array(jsonb_build_object('exercise_id', 'agachamento-livre', 'target_sets', 21, 'target_reps', 5)))$$,
  'invalid_routine_items'
);
select tests.assert_raises(
  'carga fora do passo de meio quilo',
  $$select * from public.save_routine(tests.recall('ficha')::uuid, 'Treino A',
      jsonb_build_array(jsonb_build_object('exercise_id', 'agachamento-livre', 'target_sets', 3, 'target_reps', 5, 'target_load_kg', 60.3)))$$,
  'invalid_routine_items'
);
select tests.assert_raises(
  'texto no lugar do número',
  $$select * from public.save_routine(tests.recall('ficha')::uuid, 'Treino A',
      jsonb_build_array(jsonb_build_object('exercise_id', 'agachamento-livre', 'target_sets', 'muitas', 'target_reps', 5)))$$,
  'invalid_routine_items'
);
select tests.assert_raises(
  'lista vazia',
  $$select * from public.save_routine(tests.recall('ficha')::uuid, 'Treino A', '[]'::jsonb)$$,
  'invalid_routine_items'
);
select tests.assert_raises(
  'exercício inexistente',
  $$select * from public.save_routine(tests.recall('ficha')::uuid, 'Treino A',
      jsonb_build_array(jsonb_build_object('exercise_id', 'levitacao', 'target_sets', 3, 'target_reps', 5)))$$,
  'invalid_exercise'
);
select tests.assert_equal(
  'depois das recusas, a ficha continua com o exercício válido',
  (
    select string_agg(re.exercise_id, ',' order by re.position)
    from public.routine_exercises as re
    where re.routine_id = tests.recall('ficha')::uuid
  ),
  'agachamento-livre'
);
select tests.clear_authentication();

-- caso: a ficha e o exercício de uma pessoa não existem para a outra
select tests.authenticate_as('bruno');
select tests.assert_equal(
  'Bruno não enxerga a ficha da Rita',
  (select count(*)::integer from public.routines as r where r.id = tests.recall('ficha')::uuid),
  0
);
select tests.assert_equal(
  'Bruno não enxerga os exercícios da ficha da Rita',
  (select count(*)::integer from public.routine_exercises as re where re.routine_id = tests.recall('ficha')::uuid),
  0
);
select tests.assert_equal(
  'Bruno não enxerga o exercício personalizado da Rita',
  (select count(*)::integer from public.exercises as e where e.id = tests.recall('meu_exercicio')),
  0
);
select tests.assert_true(
  'mas enxerga o catálogo inteiro',
  (select count(*) > 90 from public.exercises as e where e.owner_id is null)
);
select tests.assert_raises(
  'Bruno não altera a ficha da Rita',
  $$select * from public.save_routine(tests.recall('ficha')::uuid, 'Sequestro',
      jsonb_build_array(jsonb_build_object('exercise_id', 'burpee', 'target_sets', 3, 'target_reps', 5)))$$,
  'routine_not_found'
);
select tests.assert_equal(
  'Bruno não usa exercício personalizado alheio na própria ficha',
  (
    select count(*)::integer from public.routines as r where r.user_id = tests.user_id('bruno')
  ),
  0
);
select tests.assert_raises(
  'exercício personalizado alheio é invisível, não emprestado',
  $$select * from public.save_routine(null, 'Treino do Bruno',
      jsonb_build_array(jsonb_build_object('exercise_id', tests.recall('meu_exercicio'), 'target_sets', 3, 'target_reps', 5)))$$,
  'invalid_exercise'
);
select tests.assert_equal(
  'apagar ficha alheia não apaga nada',
  (select public.delete_routine(tests.recall('ficha')::uuid)),
  false
);
select tests.clear_authentication();

-- caso: o dono apaga a própria ficha, e os exercícios dela vão junto
select tests.authenticate_as('rita');
select tests.assert_equal('apagar a própria ficha', (select public.delete_routine(tests.recall('ficha')::uuid)), true);
select tests.assert_equal(
  'os exercícios da ficha somem com ela',
  (select count(*)::integer from public.routine_exercises as re where re.routine_id = tests.recall('ficha')::uuid),
  0
);
select tests.clear_authentication();

-- caso: o app não grava nas tabelas novas direto
select tests.authenticate_as('rita');
select tests.assert_raises(
  'inserir exercício direto',
  $$insert into public.exercises (id, name, muscle_group, equipment, sort_order) values ('pirata', 'Pirata', 'peito', 'barra', 999)$$,
  'permission denied for table exercises'
);
select tests.assert_raises(
  'inserir ficha direto',
  $$insert into public.routines (user_id, name) values (tests.user_id('rita'), 'Direto')$$,
  'permission denied for table routines'
);
select tests.clear_authentication();
