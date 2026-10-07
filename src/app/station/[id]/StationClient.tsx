"use client";
import { Station, type StationProps } from "@/components/station/Station";
import { ChatPanel } from "@/components/station/ChatPanel";
import { FinishDialog } from "@/components/station/FinishDialog";

export function StationClient(props: Omit<StationProps, "chat" | "finish">) {
  return (
    <Station
      {...props}
      chat={({ actions, append, disabled, onSpeaking }) => (
        <ChatPanel sessionId={props.session.id} patientName={props.kase.patient.name} actions={actions} append={append} disabled={disabled} onSpeaking={onSpeaking} />
      )}
      finish={({ append, disabled, forceOpen }) => <FinishDialog sessionId={props.session.id} mode={props.kase.mode} append={append} disabled={disabled} forceOpen={forceOpen} />}
    />
  );
}
