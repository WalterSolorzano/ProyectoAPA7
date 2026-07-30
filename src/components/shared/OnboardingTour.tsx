import React from 'react';
// @ts-ignore
import { Joyride } from 'react-joyride';
type Step = any;
import { useDocStore } from '../../store/useDocStore';

export const OnboardingTour: React.FC = () => {
  const { hasSeenTour, setHasSeenTour } = useDocStore();

  const steps: Step[] = [
    {
      target: 'body',
      content: '¡Bienvenido a WordAPA7! Te daremos un breve tour para que conozcas las herramientas principales.',
      placement: 'center',
    },
    {
      target: '.app-main',
      content: 'Esta es tu área de trabajo principal. Aquí podrás ver la estructura de tu documento y previsualizar cómo quedará.',
      placement: 'center',
    },
    {
      target: '.inspector-pane',
      content: 'Este es el Panel de Propiedades. Aquí podrás ver y modificar los detalles del elemento seleccionado.',
      placement: 'left',
    }
  ];

  const JoyrideComponent = Joyride as any;

  return (
    <JoyrideComponent
      steps={steps}
      run={!hasSeenTour}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      // @ts-ignore
      callback={(data: any) => {
        const { status } = data;
        const finishedStatuses: string[] = ['finished', 'skipped'];
        if (finishedStatuses.includes(status)) {
          setHasSeenTour(true);
        }
      }}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: 'Finalizar',
        next: 'Siguiente',
        skip: 'Saltar',
      }}
    />
  );
};
